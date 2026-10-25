<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Http;
use App\Models\ShelterRepository;
use App\Models\SpreadsheetSyncQueue;
use PDO;
use Throwable;

final class MySqlApiController
{
    public function __construct(
        private readonly PDO $db,
        private readonly ShelterRepository $repository,
        private readonly SpreadsheetSyncQueue $syncQueue
    ) {
    }

    public function dispatch(): never
    {
        $action = Http::input('action');
        if ($action === 'csrf' && $_SERVER['REQUEST_METHOD'] === 'GET') {
            $this->csrf();
        }
        if (!in_array($action, [
            'login', 'session', 'logout', 'getDocuments', 'getDashboardStats', 'save', 'update', 'delete',
            'listUsers', 'createUserAccount', 'updateUserAccount', 'deleteUserAccount',
            'updateOwnProfile', 'listActivity',
        ], true)) {
            Http::json(['error' => 'Unknown action.'], 404);
        }
        if ($action === 'login') {
            $this->login();
        }

        if ($action === 'logout') {
            Http::requireCsrf();
            $actor = $this->requireUser();
            $this->db->beginTransaction();
            try {
                $this->repository->logActivity($actor, '', 'Logout');
                $this->repository->revokeSession((string) $_SESSION['auth_token_hash']);
                $this->syncQueue->enqueueSnapshot('activity');
                $this->db->commit();
            } catch (Throwable $exception) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                throw $exception;
            }
            $_SESSION = [];
            if (ini_get('session.use_cookies')) {
                $parameters = session_get_cookie_params();
                setcookie(session_name(), '', [
                    'expires' => time() - 42000,
                    'path' => $parameters['path'],
                    'domain' => $parameters['domain'],
                    'secure' => $parameters['secure'],
                    'httponly' => $parameters['httponly'],
                    'samesite' => 'Strict',
                ]);
            }
            session_destroy();
            $mirrorWarning = $this->retryPendingMirror();
            Http::json(['success' => true, 'mirrorWarning' => $mirrorWarning]);
        }

        if ($action === 'session' && $_SERVER['REQUEST_METHOD'] === 'GET') {
            $user = $this->requireUser(false);
            $response = [
                'success' => true,
                'token' => (string) ($_SESSION['client_token'] ?? ''),
                'user' => $user,
                'csrfToken' => (string) ($_SESSION['csrf_token'] ?? ''),
            ];
            session_write_close();
            $this->retryPendingMirror();
            Http::json($response);
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            Http::requireCsrf();
        }
        $actor = $this->requireUser();
        session_write_close();

        try {
            $result = $this->handle($action, $actor, $this->requestParameters());
            $this->retryPendingMirror();
            Http::json($result);
        } catch (Throwable $exception) {
            $this->respondToException($exception);
        }
    }

    private function csrf(): never
    {
        if (!isset($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        Http::json(['csrfToken' => $_SESSION['csrf_token']]);
    }

    private function login(): never
    {
        Http::requireCsrf();
        $email = Http::input('email');
        $password = (string) ($_POST['password'] ?? '');
        if ($email === '' || $password === '') {
            Http::json(['error' => 'Email and password are required.'], 400);
        }
        try {
            $user = $this->repository->authenticate($email, $password);
            if ($user === null) {
                Http::json(['error' => 'Invalid email or password.'], 401);
            }
            $userId = $this->repository->userIdByEmail($user['email']);
            if ($userId === null) {
                throw new \RuntimeException('Authenticated MySQL user could not be found.');
            }

            $clientToken = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $clientToken);
            $this->repository->createSession($userId, $tokenHash);

            session_regenerate_id(true);
            $_SESSION['auth_token_hash'] = $tokenHash;
            $_SESSION['client_token'] = $clientToken;
            $_SESSION['auth_expires_at'] = time() + 8 * 60 * 60;
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            $csrfToken = $_SESSION['csrf_token'];

            $this->db->beginTransaction();
            $this->repository->logActivity($user, '', 'Login');
            $this->syncQueue->enqueueSnapshot('activity');
            $this->db->commit();

            session_write_close();
            $warning = $this->syncQueue->processPending()['warning'];
            Http::json([
                'success' => true,
                'token' => $clientToken,
                'user' => $user,
                'csrfToken' => $csrfToken,
                'mirrorWarning' => $warning,
            ]);
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            $this->respondToException($exception);
        }
    }

    private function requireUser(bool $requireRequestToken = true): array
    {
        $requestToken = Http::input('token');
        $sessionHash = (string) ($_SESSION['auth_token_hash'] ?? '');
        if ($sessionHash === ''
            || ($requireRequestToken && ($requestToken === '' || !hash_equals($sessionHash, hash('sha256', $requestToken))))
            || (int) ($_SESSION['auth_expires_at'] ?? 0) <= time()) {
            Http::json(['error' => 'Authentication required.'], 401);
        }
        $user = $this->repository->userBySessionHash($sessionHash);
        if ($user === null) {
            Http::json(['error' => 'Session expired or account inactive.'], 401);
        }
        return $user;
    }

    private function handle(string $action, array $actor, array $input): array
    {
        if ($action === 'getDashboardStats') {
            return $this->repository->dashboardStats($actor, (string) ($input['office'] ?? ''));
        }
        if ($action === 'getDocuments') {
            $module = (string) ($input['module'] ?? '');
            $this->validateSheet($module, (string) ($input['sheet'] ?? ''));
            return $this->repository->listRecords($actor, $module, (string) ($input['office'] ?? ''));
        }
        if ($action === 'listUsers') {
            return $this->repository->listUsers($actor);
        }
        if ($action === 'listActivity') {
            return $this->repository->listActivity($actor);
        }
        if ($action === 'save') {
            $module = (string) ($input['module'] ?? '');
            $this->validateSheet($module, (string) ($input['sheet'] ?? ''));
            return $this->write(function () use ($actor, $input, $module): array {
                $result = $this->repository->createRecord($actor, $input);
                $this->repository->logActivity($actor, $module, 'Create', (string) ($input['recordId'] ?? $result['recordId'] ?? ''));
                $this->syncQueue->enqueueSnapshot('records', $module);
                $this->syncQueue->enqueueSnapshot('activity');
                return $result;
            });
        }
        if ($action === 'update' || $action === 'delete') {
            $module = (string) ($input['module'] ?? '');
            $this->validateSheet($module, (string) ($input['sheet'] ?? ''));
            return $this->write(function () use ($actor, $input, $module, $action): array {
                $result = $action === 'update'
                    ? $this->repository->updateRecord($actor, $input)
                    : $this->repository->deleteRecord($actor, $input);
                $this->repository->logActivity(
                    $actor,
                    $module,
                    $action === 'update' ? 'Edit' : 'Delete',
                    (string) ($input['idValue'] ?? '')
                );
                $this->syncQueue->enqueueSnapshot('records', $module);
                $this->syncQueue->enqueueSnapshot('activity');
                return $result;
            });
        }
        if ($action === 'createUserAccount') {
            return $this->write(function () use ($actor, $input): array {
                $result = $this->repository->createUser($actor, $input);
                $this->repository->logActivity($actor, 'users', 'Create Account', (string) ($input['email'] ?? ''));
                $this->syncQueue->enqueueSnapshot('users');
                $this->syncQueue->enqueueSnapshot('activity');
                return $result;
            });
        }
        if ($action === 'updateUserAccount') {
            return $this->write(function () use ($actor, $input): array {
                $result = $this->repository->updateUser($actor, $input);
                $this->repository->logActivity($actor, 'users', 'Update Account', (string) ($input['email'] ?? ''));
                $this->syncQueue->enqueueSnapshot('users');
                $this->syncQueue->enqueueSnapshot('activity');
                return $result;
            });
        }
        if ($action === 'deleteUserAccount') {
            return $this->write(function () use ($actor, $input): array {
                $result = $this->repository->deleteUser($actor, (string) ($input['email'] ?? ''));
                $this->repository->logActivity($actor, 'users', 'Delete Account', (string) ($input['email'] ?? ''));
                $this->syncQueue->enqueueSnapshot('users');
                $this->syncQueue->enqueueSnapshot('activity');
                return $result;
            });
        }
        if ($action === 'updateOwnProfile') {
            return $this->write(function () use ($actor, $input): array {
                $sessionHash = (string) ($_SESSION['auth_token_hash'] ?? '');
                $result = $this->repository->updateOwnProfile($actor, $input, $sessionHash);
                $updatedActor = array_merge($actor, $result['user']);
                $this->repository->logActivity($updatedActor, 'profile', 'Update Profile');
                $this->syncQueue->enqueueSnapshot('users');
                $this->syncQueue->enqueueSnapshot('activity');
                return $result;
            });
        }
        throw new \InvalidArgumentException('Unknown action.');
    }

    private function write(callable $operation): array
    {
        $this->db->beginTransaction();
        try {
            $result = $operation();
            $this->db->commit();
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }

        $sync = $this->syncQueue->processPending();
        if ($sync['warning'] !== '') {
            $result['mirrorWarning'] = $sync['warning'];
        }
        return $result;
    }

    private function retryPendingMirror(): string
    {
        $sync = $this->syncQueue->processPending();
        if ($sync['warning'] !== '') {
            error_log($sync['warning']);
        }
        return $sync['warning'];
    }

    private function validateSheet(string $module, string $sheet): void
    {
        if (!isset(ShelterRepository::MODULES[$module])
            || ShelterRepository::MODULES[$module] !== $sheet) {
            throw new \InvalidArgumentException('The records module and sheet do not match.');
        }
    }

    private function requestParameters(): array
    {
        $source = $_SERVER['REQUEST_METHOD'] === 'GET' ? $_GET : $_POST;
        $parameters = [];
        foreach ($source as $key => $value) {
            if ($key !== 'token' && is_scalar($value)) {
                $parameters[$key] = (string) $value;
            }
        }
        return $parameters;
    }

    private function respondToException(Throwable $exception): never
    {
        if ($exception instanceof \InvalidArgumentException) {
            Http::json(['error' => $exception->getMessage()], 400);
        }
        if ($exception instanceof \OutOfBoundsException) {
            Http::json(['error' => $exception->getMessage()], 404);
        }
        if ($exception instanceof \DomainException) {
            $message = $exception->getMessage();
            $status = str_contains(strtolower($message), 'already exists')
                || str_contains(strtolower($message), 'changed or no longer exists')
                || str_contains(strtolower($message), 'duplicate')
                ? 409 : 403;
            Http::json(['error' => $message], $status);
        }
        error_log('DHSUD MySQL API operation failed: ' . $exception->getMessage());
        Http::json(['error' => 'The requested database operation could not be completed.'], 500);
    }
}
