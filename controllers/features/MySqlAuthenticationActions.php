<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Http;
use Throwable;

trait MySqlAuthenticationActions
{
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
}
