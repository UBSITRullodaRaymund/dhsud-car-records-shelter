<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\GoogleSheetsBridge;
use App\Core\Http;
use App\Models\SpreadsheetMirror;
use PDO;

final class SpreadsheetApiController
{
    private const MODULES = [
        'incoming' => 'Incoming Documents',
        'outgoing' => 'Outgoing Documents',
        'dockets' => 'Dockets Issuances',
        'docketsMapping' => 'Dockets Mapping',
        'foi' => 'FOI',
    ];

    private const ACTIONS = [
        'login',
        'session',
        'logout',
        'getDocuments',
        'getDashboardStats',
        'save',
        'update',
        'delete',
        'listUsers',
        'createUserAccount',
        'updateUserAccount',
        'deleteUserAccount',
        'updateOwnProfile',
        'listActivity',
    ];

    public function __construct(
        private readonly PDO $db,
        private readonly GoogleSheetsBridge $bridge,
        private readonly SpreadsheetMirror $mirror
    ) {
    }

    public function dispatch(): never
    {
        $action = Http::input('action');
        if ($action === 'csrf' && $_SERVER['REQUEST_METHOD'] === 'GET') {
            $this->csrf();
        }
        if (!in_array($action, self::ACTIONS, true)) {
            Http::json(['error' => 'Unknown action.'], 404);
        }

        if ($action === 'login') {
            $this->login();
        }
        if ($action === 'session' && $_SERVER['REQUEST_METHOD'] === 'GET') {
            $user = $this->requireUser();
            Http::json([
                'success' => true,
                'token' => bin2hex(random_bytes(32)),
                'user' => $user,
                'csrfToken' => $_SESSION['csrf_token'] ?? '',
            ]);
        }

        if ($action === 'logout') {
            Http::requireCsrf();
            $this->logout();
        }

        $user = $this->requireUser();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            Http::requireCsrf();
        }

        $gasToken = (string) $_SESSION['gas_token'];
        session_write_close();

        $parameters = $this->requestParameters();
        unset($parameters['csrfToken']);
        if (in_array($action, ['update', 'delete'], true)) {
            $this->verifyRecordVersion($user, $parameters);
            $parameters['syncVersion'] = (string) $parameters['_syncVersion'];
            unset($parameters['_syncVersion']);
        }
        $parameters['token'] = $gasToken;
        $result = $this->bridge->request($_SERVER['REQUEST_METHOD'] === 'GET' ? 'GET' : 'POST', $parameters);

        if ($action === 'updateOwnProfile' && !isset($result['error']) && is_array($result['user'] ?? null)) {
            session_start();
            $_SESSION['gas_user'] = $result['user'];
            session_write_close();
        }

        if (isset($result['error'])) {
            $error = (string) $result['error'];
            $status = !empty($result['conflict']) ? 409
                : (str_contains(strtolower($error), 'forbidden') ? 403
                    : (str_contains(strtolower($error), 'session') ? 401
                        : (str_contains(strtolower($error), 'already exists') ? 409
                            : (str_contains(strtolower($error), 'password') ? 403 : 400))));
            Http::json($result, $status);
        }

        if ($action === 'getDocuments' && is_array($result)) {
            foreach ($result as &$record) {
                if (is_array($record)) {
                    $record['_syncVersion'] = $this->recordVersion($record);
                }
            }
            unset($record);
            $this->syncRecords($user, $parameters, $result);
        } elseif ($action === 'listUsers' && is_array($result)) {
            $this->syncUsers($user, $result);
        } elseif ($action === 'listActivity' && is_array($result)) {
            $this->syncActivity($user, $result);
        } elseif (in_array($action, ['save', 'update', 'delete'], true) && !empty($result['success'])) {
            if (!$this->refreshRecords($user, $parameters)) {
                $result['mirrorWarning'] = 'Google Sheets was updated, but the MySQL records mirror could not be refreshed.';
            }
            if (in_array($user['role'] ?? '', ['SuperAdmin', 'OfficeAdmin'], true) && !$this->refreshActivity($user)) {
                $result['mirrorWarning'] = 'Google Sheets was updated, but one or more MySQL mirrors could not be refreshed.';
            }
        } elseif (in_array($action, ['createUserAccount', 'updateUserAccount', 'deleteUserAccount'], true)
            && !empty($result['success'])) {
            if (!$this->refreshUsers($user)) {
                $result['mirrorWarning'] = 'The account was updated in Google Sheets, but the MySQL users mirror could not be refreshed.';
            }
            if (in_array($user['role'] ?? '', ['SuperAdmin', 'OfficeAdmin'], true) && !$this->refreshActivity($user)) {
                $result['mirrorWarning'] = 'Google Sheets was updated, but one or more MySQL mirrors could not be refreshed.';
            }
        } elseif ($action === 'updateOwnProfile' && !empty($result['success']) && is_array($result['user'] ?? null)) {
            try {
                $this->mirror->updateUserProfile((string) ($user['email'] ?? ''), $result['user']);
            } catch (\Throwable $exception) {
                error_log('MySQL user mirror refresh failed after profile update: ' . $exception->getMessage());
                $result['mirrorWarning'] = 'Your profile was updated in Google Sheets, but the MySQL user mirror could not be refreshed.';
            }
            if (in_array($user['role'] ?? '', ['SuperAdmin', 'OfficeAdmin'], true) && !$this->refreshActivity($user)) {
                $result['mirrorWarning'] = 'Your profile was updated, but the MySQL activity mirror could not be refreshed.';
            }
        }

        Http::json($result);
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

        $result = $this->bridge->request('POST', [
            'action' => 'login',
            'email' => $email,
            'password' => $password,
        ]);
        if (!empty($result['error'])) {
            Http::json($result, 401);
        }
        if (empty($result['token']) || empty($result['user']) || !is_array($result['user'])) {
            throw new \RuntimeException('Apps Script login response is missing its session or user.');
        }

        session_regenerate_id(true);
        $_SESSION['gas_token'] = (string) $result['token'];
        $_SESSION['gas_user'] = $result['user'];
        $_SESSION['gas_expires_at'] = time() + 8 * 60 * 60;
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        $result['token'] = bin2hex(random_bytes(32));
        $result['csrfToken'] = $_SESSION['csrf_token'];

        Http::json($result);
    }

    private function logout(): never
    {
        $token = $_SESSION['gas_token'] ?? null;
        if (is_string($token) && $token !== '') {
            try {
                $this->bridge->request('POST', ['action' => 'logout', 'token' => $token]);
            } catch (\Throwable $exception) {
                error_log('Apps Script logout failed: ' . $exception->getMessage());
            }
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
        Http::json(['success' => true]);
    }

    private function requireUser(): array
    {
        if (empty($_SESSION['gas_token']) || !is_array($_SESSION['gas_user'] ?? null)
            || (int) ($_SESSION['gas_expires_at'] ?? 0) <= time()) {
            Http::json(['error' => 'Authentication required.'], 401);
        }

        return $_SESSION['gas_user'];
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
        if (!isset($parameters['action'])) {
            $parameters['action'] = Http::input('action');
        }

        return $parameters;
    }

    private function syncRecords(array $user, array $parameters, array $result): void
    {
        $module = (string) ($parameters['module'] ?? '');
        if (!isset(self::MODULES[$module]) || self::MODULES[$module] !== ($parameters['sheet'] ?? '')) {
            return;
        }
        $office = $user['role'] === 'SuperAdmin'
            ? (string) ($parameters['office'] ?? $user['office'] ?? '')
            : (string) ($user['office'] ?? '');
        if ($office === '') {
            return;
        }
        $this->safeMirror(function () use ($module, $office, $result): void {
            $this->mirror->records($module, $office, $result);
        });
    }

    private function verifyRecordVersion(array $user, array $parameters): void
    {
        $module = (string) ($parameters['module'] ?? '');
        $sheet = (string) ($parameters['sheet'] ?? '');
        $idField = (string) ($parameters['idField'] ?? '');
        $idValue = (string) ($parameters['idValue'] ?? '');
        $expected = (string) ($parameters['_syncVersion'] ?? '');
        if (!isset(self::MODULES[$module]) || self::MODULES[$module] !== $sheet
            || $idField === '' || $idValue === '' || $expected === '') {
            Http::json(['error' => 'This record was not loaded with a version token. Reload it before editing.'], 409);
        }

        $office = $user['role'] === 'SuperAdmin'
            ? (string) ($parameters['office'] ?? $user['office'] ?? '')
            : (string) ($user['office'] ?? '');
        $fresh = $this->bridge->request('GET', [
            'action' => 'getDocuments',
            'module' => $module,
            'sheet' => $sheet,
            'office' => $office,
            'token' => $_SESSION['gas_token'],
        ]);
        if (!is_array($fresh) || isset($fresh['error'])) {
            Http::json(['error' => 'Could not check the current spreadsheet version. No changes were made.'], 502);
        }

        foreach ($fresh as $record) {
            if (!is_array($record) || !array_key_exists($idField, $record)
                || (string) $record[$idField] !== $idValue) {
                continue;
            }
            if (!hash_equals($this->recordVersion($record), $expected)) {
                Http::json([
                    'error' => 'This record changed in the spreadsheet after you opened it. Reload it and review the newer version before saving.',
                    'conflict' => true,
                ], 409);
            }

            return;
        }

        Http::json(['error' => 'Record not found in the current spreadsheet. No changes were made.'], 404);
    }

    private function recordVersion(array $record): string
    {
        unset($record['_syncVersion']);
        return hash('sha256', json_encode(
            $record,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        ));
    }

    private function refreshRecords(array $user, array $parameters): bool
    {
        $module = (string) ($parameters['module'] ?? '');
        if (!isset(self::MODULES[$module]) || self::MODULES[$module] !== ($parameters['sheet'] ?? '')) {
            return false;
        }
        $office = $user['role'] === 'SuperAdmin'
            ? (string) ($parameters['office'] ?? $user['office'] ?? '')
            : (string) ($user['office'] ?? '');
        if ($office === '') {
            return false;
        }
        try {
            $result = $this->bridge->request('GET', [
                'action' => 'getDocuments',
                'module' => $module,
                'sheet' => self::MODULES[$module],
                'office' => $office,
                'token' => $_SESSION['gas_token'],
            ]);
            if (is_array($result) && !isset($result['error'])) {
                $this->mirror->records($module, $office, $result);
                return true;
            } else {
                error_log('MySQL records mirror refresh failed: Apps Script did not return a record list.');
            }
        } catch (\Throwable $exception) {
            error_log('MySQL records mirror refresh failed after the Google Sheets write: ' . $exception->getMessage());
        }
        return false;
    }

    private function syncUsers(array $user, array $result): void
    {
        $this->safeMirror(function () use ($user, $result): void {
            $this->mirror->users($result, (string) $user['role'], (string) $user['office']);
        });
    }

    private function refreshUsers(array $user): bool
    {
        try {
            $result = $this->bridge->request('POST', [
                'action' => 'listUsers',
                'token' => $_SESSION['gas_token'],
            ]);
            if (is_array($result) && !isset($result['error'])) {
                $this->mirror->users($result, (string) $user['role'], (string) $user['office']);
                return true;
            } else {
                error_log('MySQL user mirror refresh failed after the Google Sheets account change.');
            }
        } catch (\Throwable $exception) {
            error_log('MySQL user mirror refresh failed after the Google Sheets account change: ' . $exception->getMessage());
        }
        return false;
    }

    private function syncActivity(array $user, array $result): void
    {
        $this->safeMirror(function () use ($user, $result): void {
            $this->mirror->activity($result, (string) $user['role'], (string) $user['office']);
        });
    }

    private function refreshActivity(array $user): bool
    {
        try {
            $result = $this->bridge->request('POST', [
                'action' => 'listActivity',
                'token' => $_SESSION['gas_token'],
            ]);
            if (is_array($result) && !isset($result['error'])) {
                $this->mirror->activity($result, (string) $user['role'], (string) $user['office']);
                return true;
            } else {
                error_log('MySQL activity mirror refresh failed after a Google Sheets change.');
            }
        } catch (\Throwable $exception) {
            error_log('MySQL activity mirror refresh failed after a Google Sheets change: ' . $exception->getMessage());
        }
        return false;
    }

    private function safeMirror(callable $sync): void
    {
        try {
            $sync();
        } catch (\Throwable $exception) {
            error_log('Google Sheets data was returned, but the MySQL mirror update failed: ' . $exception->getMessage());
        }
    }
}
