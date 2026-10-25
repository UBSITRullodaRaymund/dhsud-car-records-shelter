<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Http;
use App\Models\ShelterRepository;
use App\Models\SpreadsheetSyncQueue;
use PDO;
use Throwable;

require_once __DIR__ . '/features/MySqlAuthenticationActions.php';
require_once __DIR__ . '/features/MySqlReadActions.php';
require_once __DIR__ . '/features/MySqlRecordActions.php';
require_once __DIR__ . '/features/MySqlUserActions.php';

final class MySqlApiController
{
    use MySqlAuthenticationActions,
        MySqlReadActions,
        MySqlRecordActions,
        MySqlUserActions;

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

    private function handle(string $action, array $actor, array $input): array
    {
        if (in_array($action, ['getDashboardStats', 'getDocuments', 'listUsers', 'listActivity'], true)) {
            return $this->readAction($action, $actor, $input);
        }
        if ($action === 'save') {
            return $this->createRecordAction($actor, $input);
        }
        if (in_array($action, ['update', 'delete'], true)) {
            return $this->mutateRecordAction($action, $actor, $input);
        }
        if (in_array($action, [
            'createUserAccount',
            'updateUserAccount',
            'deleteUserAccount',
            'updateOwnProfile',
        ], true)) {
            return $this->manageUserAction($action, $actor, $input);
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
