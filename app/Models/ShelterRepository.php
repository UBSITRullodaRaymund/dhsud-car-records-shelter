<?php
declare(strict_types=1);

namespace App\Models;

use PDO;

final class ShelterRepository
{
    public const MODULES = [
        'incoming' => 'Incoming Documents',
        'outgoing' => 'Outgoing Documents',
        'dockets' => 'Dockets Issuances',
        'docketsMapping' => 'Dockets Mapping',
        'foi' => 'FOI',
    ];

    public const OFFICES = [
        'Administrative and Finance Office',
        'Housing Real Estate Development Regulation Office',
        'Homeowners Association and Community Development Office',
        'Environmental, Land Use and Urban Planning Office',
        'Public Housing and Settlement Division',
        'Office of the Regional Director',
    ];

    public function __construct(private readonly PDO $db)
    {
    }

    public function authenticate(string $email, string $password): ?array
    {
        $statement = $this->db->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $statement->execute(['email' => mb_strtolower(trim($email))]);
        $row = $statement->fetch();
        if (!$row || $row['status'] !== 'Active' || !$this->verifyPassword($password, $row)) {
            return null;
        }

        if (!empty($row['source_password_salt'])) {
            $update = $this->db->prepare(
                'UPDATE users SET password_hash = :password_hash, source_password_salt = NULL WHERE id = :id'
            );
            $update->execute([
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'id' => $row['id'],
            ]);
        } elseif (password_needs_rehash($row['password_hash'], PASSWORD_DEFAULT)) {
            $update = $this->db->prepare('UPDATE users SET password_hash = :password_hash WHERE id = :id');
            $update->execute([
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'id' => $row['id'],
            ]);
        }

        return $this->publicUser($row);
    }

    public function userBySessionHash(string $sessionHash): ?array
    {
        $statement = $this->db->prepare(
            'SELECT u.* FROM auth_sessions s
             JOIN users u ON u.id = s.user_id
             WHERE s.session_hash = :session_hash AND s.expires_at > CURRENT_TIMESTAMP
             LIMIT 1'
        );
        $statement->execute(['session_hash' => $sessionHash]);
        $row = $statement->fetch();
        if (!$row || $row['status'] !== 'Active') {
            return null;
        }

        return $this->publicUser($row);
    }

    public function createSession(int $userId, string $sessionHash, string $expiresAt): void
    {
        $statement = $this->db->prepare(
            'INSERT INTO auth_sessions (session_hash, user_id, expires_at)
             VALUES (:session_hash, :user_id, :expires_at)'
        );
        $statement->execute([
            'session_hash' => $sessionHash,
            'user_id' => $userId,
            'expires_at' => $expiresAt,
        ]);
    }

    public function userIdByEmail(string $email): ?int
    {
        $statement = $this->db->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $statement->execute(['email' => mb_strtolower(trim($email))]);
        $id = $statement->fetchColumn();
        return $id === false ? null : (int) $id;
    }

    public function revokeSession(string $sessionHash): void
    {
        $statement = $this->db->prepare('DELETE FROM auth_sessions WHERE session_hash = :session_hash');
        $statement->execute(['session_hash' => $sessionHash]);
    }

    public function revokeUserSessions(int $userId): void
    {
        $statement = $this->db->prepare('DELETE FROM auth_sessions WHERE user_id = :user_id');
        $statement->execute(['user_id' => $userId]);
    }

    public function listUsers(array $actor): array
    {
        $this->requireAdmin($actor);
        if ($actor['role'] === 'SuperAdmin') {
            $statement = $this->db->query(
                'SELECT email, full_name AS fullName, role, office, status, permissions FROM users ORDER BY full_name'
            );
        } else {
            $statement = $this->db->prepare(
                'SELECT email, full_name AS fullName, role, office, status, permissions
                 FROM users WHERE office = :office ORDER BY full_name'
            );
            $statement->execute(['office' => $actor['office']]);
        }
        return array_map(static function (array $user): array {
            $user['permissions'] = self::decodePermissions($user['permissions']);
            return $user;
        }, $statement->fetchAll());
    }

    public function createUser(array $actor, array $input): array
    {
        $this->requireAdmin($actor);
        $email = mb_strtolower(trim((string) ($input['email'] ?? '')));
        $fullName = trim((string) ($input['fullName'] ?? ''));
        $password = (string) ($input['password'] ?? '');
        $role = trim((string) ($input['role'] ?? 'OfficeStaff'));
        $office = trim((string) ($input['office'] ?? ''));
        $status = trim((string) ($input['status'] ?? 'Active'));
        $permissions = $this->validatedPermissions((string) ($input['permissions'] ?? ''));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $fullName === '' || strlen($fullName) > 255
            || strlen($password) < 8 || !in_array($role, ['SuperAdmin', 'OfficeAdmin', 'OfficeStaff'], true)
            || !in_array($office, self::OFFICES, true) || !in_array($status, ['Active', 'Inactive'], true)) {
            throw new \InvalidArgumentException('Enter valid account details. Passwords must be at least 8 characters.');
        }
        if ($actor['role'] !== 'SuperAdmin'
            && ($office !== $actor['office'] || $role === 'SuperAdmin')) {
            throw new \DomainException('You can only create non-Super Admin accounts for your own office.');
        }

        $statement = $this->db->prepare(
            'INSERT INTO users (email, password_hash, full_name, role, office, status, permissions)
             VALUES (:email, :password_hash, :full_name, :role, :office, :status, :permissions)'
        );
        try {
            $statement->execute([
                'email' => $email,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'full_name' => $fullName,
                'role' => $role,
                'office' => $office,
                'status' => $status,
                'permissions' => json_encode($permissions, JSON_THROW_ON_ERROR),
            ]);
        } catch (\PDOException $exception) {
            if ((string) $exception->getCode() === '23000') {
                throw new \DomainException('An account with this email already exists.');
            }
            throw $exception;
        }
        return ['success' => true];
    }

    public function updateUser(array $actor, array $input): array
    {
        $this->requireAdmin($actor);
        $email = mb_strtolower(trim((string) ($input['email'] ?? '')));
        if ($email === '') {
            throw new \InvalidArgumentException('Email is required.');
        }
        $statement = $this->db->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $statement->execute(['email' => $email]);
        $target = $statement->fetch();
        if (!$target) {
            throw new \OutOfBoundsException('Account not found.');
        }
        if ($actor['role'] !== 'SuperAdmin' && $target['office'] !== $actor['office']) {
            throw new \DomainException('You can only manage accounts in your own office.');
        }

        $fullName = trim((string) ($input['fullName'] ?? $target['full_name']));
        $office = trim((string) ($input['office'] ?? $target['office']));
        $role = trim((string) ($input['role'] ?? $target['role']));
        $status = trim((string) ($input['status'] ?? $target['status']));
        $permissions = $this->validatedPermissions((string) ($input['permissions'] ?? implode(',', self::decodePermissions($target['permissions']))));
        $password = (string) ($input['password'] ?? '');
        if ($fullName === '' || strlen($fullName) > 255
            || !in_array($office, self::OFFICES, true)
            || !in_array($role, ['SuperAdmin', 'OfficeAdmin', 'OfficeStaff'], true)
            || !in_array($status, ['Active', 'Inactive'], true)
            || ($password !== '' && strlen($password) < 8)) {
            throw new \InvalidArgumentException('Enter valid account details. Passwords must be at least 8 characters.');
        }
        if ($actor['role'] !== 'SuperAdmin'
            && ($office !== $actor['office'] || $role === 'SuperAdmin')) {
            throw new \DomainException('You can only assign accounts to your own office and cannot grant Super Admin.');
        }

        $sql = 'UPDATE users SET full_name = :full_name, office = :office, role = :role, status = :status,
                permissions = :permissions';
        $parameters = [
            'full_name' => $fullName,
            'office' => $office,
            'role' => $role,
            'status' => $status,
            'permissions' => json_encode($permissions, JSON_THROW_ON_ERROR),
            'id' => $target['id'],
        ];
        if ($password !== '') {
            $sql .= ', password_hash = :password_hash, source_password_salt = NULL';
            $parameters['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        }
        $sql .= ' WHERE id = :id';
        $this->db->prepare($sql)->execute($parameters);
        if ($status !== 'Active') {
            $this->revokeUserSessions((int) $target['id']);
        }
        return ['success' => true];
    }

    public function deleteUser(array $actor, string $email): array
    {
        $this->requireAdmin($actor);
        $email = mb_strtolower(trim($email));
        if ($email === mb_strtolower((string) $actor['email'])) {
            throw new \DomainException('You cannot delete your own account.');
        }
        $statement = $this->db->prepare('SELECT id, office FROM users WHERE email = :email LIMIT 1');
        $statement->execute(['email' => $email]);
        $target = $statement->fetch();
        if (!$target) {
            throw new \OutOfBoundsException('Account not found.');
        }
        if ($actor['role'] !== 'SuperAdmin' && $target['office'] !== $actor['office']) {
            throw new \DomainException('You can only manage accounts in your own office.');
        }
        $delete = $this->db->prepare('DELETE FROM users WHERE id = :id');
        $delete->execute(['id' => $target['id']]);
        return ['success' => true];
    }

    public function updateOwnProfile(array $actor, array $input, string $currentSessionHash): array
    {
        $currentPassword = (string) ($input['currentPassword'] ?? '');
        $fullName = trim((string) ($input['fullName'] ?? ''));
        $email = mb_strtolower(trim((string) ($input['email'] ?? '')));
        $newPassword = (string) ($input['newPassword'] ?? '');
        if ($currentPassword === '' || $fullName === '' || strlen($fullName) > 255
            || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254
            || ($newPassword !== '' && strlen($newPassword) < 8)) {
            throw new \InvalidArgumentException('Enter a valid name and email. New passwords must be at least 8 characters.');
        }

        $statement = $this->db->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $actor['id']]);
        $row = $statement->fetch();
        if (!$row || !$this->verifyPassword($currentPassword, $row)) {
            throw new \DomainException('Current password is incorrect.');
        }

        $sql = 'UPDATE users SET email = :email, full_name = :full_name';
        $parameters = ['email' => $email, 'full_name' => $fullName, 'id' => $actor['id']];
        if ($newPassword !== '') {
            $sql .= ', password_hash = :password_hash, source_password_salt = NULL';
            $parameters['password_hash'] = password_hash($newPassword, PASSWORD_DEFAULT);
        }
        $sql .= ' WHERE id = :id';
        try {
            $this->db->prepare($sql)->execute($parameters);
        } catch (\PDOException $exception) {
            if ((string) $exception->getCode() === '23000') {
                throw new \DomainException('An account with this email already exists.');
            }
            throw $exception;
        }
        if ($newPassword !== '') {
            $revoke = $this->db->prepare(
                'DELETE FROM auth_sessions WHERE user_id = :user_id AND session_hash <> :session_hash'
            );
            $revoke->execute(['user_id' => $actor['id'], 'session_hash' => $currentSessionHash]);
        }
        return ['success' => true, 'user' => $this->publicUser($row, $fullName, $email)];
    }

    public function listRecords(array $actor, string $module, string $office): array
    {
        $this->requireModule($actor, $module, 'view');
        $office = $this->resolveOffice($actor, $office);
        $statement = $this->db->prepare(
            'SELECT id, record_data FROM records WHERE module = :module AND office = :office ORDER BY id FOR UPDATE'
        );
        $statement->execute(['module' => $module, 'office' => $office]);
        $records = [];
        foreach ($statement->fetchAll() as $row) {
            $record = json_decode($row['record_data'], true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($record)) {
                continue;
            }
            $record['_syncVersion'] = $this->recordVersion($record);
            $records[] = $record;
        }
        return $records;
    }

    public function createRecord(array $actor, array $input): array
    {
        $module = (string) ($input['module'] ?? '');
        $this->requireModule($actor, $module, 'create');
        $office = $this->resolveOffice($actor, (string) ($input['office'] ?? ''));
        $data = $this->recordPayload($input);
        if ($data === []) {
            throw new \InvalidArgumentException('A record must contain at least one field.');
        }
        if (!array_key_exists('office', $data) || trim((string) $data['office']) === '') {
            $data['office'] = $office;
        }
        $statement = $this->db->prepare(
            'INSERT INTO records (module, source_sheet, office, record_data)
             VALUES (:module, :source_sheet, :office, :record_data)'
        );
        $statement->execute([
            'module' => $module,
            'source_sheet' => self::MODULES[$module],
            'office' => $office,
            'record_data' => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        ]);
        return ['success' => true, 'recordId' => (string) $this->db->lastInsertId()];
    }

    public function updateRecord(array $actor, array $input): array
    {
        $module = (string) ($input['module'] ?? '');
        $this->requireModule($actor, $module, 'edit');
        $office = $this->resolveOffice($actor, (string) ($input['office'] ?? ''));
        $row = $this->findRecordForMutation($module, $office, $input);
        $oldData = json_decode($row['record_data'], true, 512, JSON_THROW_ON_ERROR);
        $updated = array_merge($oldData, $this->recordPayload($input));
        $update = $this->db->prepare('UPDATE records SET record_data = :record_data WHERE id = :id');
        $update->execute([
            'record_data' => json_encode($updated, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'id' => $row['id'],
        ]);
        return ['success' => true];
    }

    public function deleteRecord(array $actor, array $input): array
    {
        $module = (string) ($input['module'] ?? '');
        $this->requireModule($actor, $module, 'delete');
        $office = $this->resolveOffice($actor, (string) ($input['office'] ?? ''));
        $row = $this->findRecordForMutation($module, $office, $input);
        $delete = $this->db->prepare('DELETE FROM records WHERE id = :id');
        $delete->execute(['id' => $row['id']]);
        return ['success' => true];
    }

    public function dashboardStats(array $actor, string $requestedOffice): array
    {
        $office = $this->resolveOffice($actor, $requestedOffice);
        $modules = [];
        $totals = ['In progress' => 0, 'Pending' => 0, 'Completed' => 0, 'Other' => 0];
        foreach (self::MODULES as $module => $_sheet) {
            if (!$this->hasPermission($actor, $module . ':view')) {
                $modules[$module] = ['allowed' => false];
                continue;
            }
            $statement = $this->db->prepare('SELECT record_data FROM records WHERE module = :module AND office = :office');
            $statement->execute(['module' => $module, 'office' => $office]);
            $statuses = ['In progress' => 0, 'Pending' => 0, 'Completed' => 0, 'Other' => 0];
            $count = 0;
            foreach ($statement->fetchAll(PDO::FETCH_COLUMN) as $json) {
                $record = json_decode((string) $json, true, 512, JSON_THROW_ON_ERROR);
                if (!is_array($record) || !$this->hasData($record)) {
                    continue;
                }
                $count++;
                $category = $this->statusCategory((string) ($record['status'] ?? ''));
                if ($category !== '') {
                    $statuses[$category]++;
                    $totals[$category]++;
                }
            }
            $modules[$module] = ['allowed' => true, 'count' => $count, 'statuses' => $statuses];
        }
        return ['success' => true, 'office' => $office, 'modules' => $modules, 'statuses' => $totals];
    }

    public function listActivity(array $actor): array
    {
        $this->requireAdmin($actor);
        if ($actor['role'] === 'SuperAdmin') {
            $statement = $this->db->query(
                'SELECT occurred_at AS Timestamp, email AS Email, full_name AS FullName, role AS Role,
                        office AS Office, module AS Module, action AS Action, record_id AS RecordId
                 FROM activity_logs ORDER BY id DESC LIMIT 2000'
            );
        } else {
            $statement = $this->db->prepare(
                'SELECT occurred_at AS Timestamp, email AS Email, full_name AS FullName, role AS Role,
                        office AS Office, module AS Module, action AS Action, record_id AS RecordId
                 FROM activity_logs WHERE office = :office ORDER BY id DESC LIMIT 2000'
            );
            $statement->execute(['office' => $actor['office']]);
        }
        return $statement->fetchAll();
    }

    public function logActivity(array $actor, string $module, string $action, string $recordId = ''): void
    {
        $statement = $this->db->prepare(
            'INSERT INTO activity_logs (user_id, email, full_name, role, office, module, action, record_id, occurred_at)
             VALUES (:user_id, :email, :full_name, :role, :office, :module, :action, :record_id, CURRENT_TIMESTAMP)'
        );
        $statement->execute([
            'user_id' => $actor['id'] ?? null,
            'email' => $actor['email'] ?? '',
            'full_name' => $actor['fullName'] ?? '',
            'role' => $actor['role'] ?? '',
            'office' => $actor['office'] ?? '',
            'module' => $module,
            'action' => $action,
            'record_id' => $recordId,
        ]);
    }

    public function requireModule(array $actor, string $module, string $permission): void
    {
        if (!isset(self::MODULES[$module])) {
            throw new \InvalidArgumentException('Unknown records module.');
        }
        if (!$this->hasPermission($actor, $module . ':' . $permission)) {
            throw new \DomainException('Forbidden: your account does not have permission for this action.');
        }
    }

    public function resolveOffice(array $actor, string $requestedOffice): string
    {
        if ($actor['role'] !== 'SuperAdmin') {
            return (string) $actor['office'];
        }
        if ($requestedOffice !== '' && in_array($requestedOffice, self::OFFICES, true)) {
            return $requestedOffice;
        }
        return (string) $actor['office'];
    }

    private function requireAdmin(array $actor): void
    {
        if (!in_array($actor['role'] ?? '', ['SuperAdmin', 'OfficeAdmin'], true)) {
            throw new \DomainException('Forbidden: administrator access is required.');
        }
    }

    private function hasPermission(array $actor, string $permission): bool
    {
        return ($actor['role'] ?? '') === 'SuperAdmin'
            || in_array($permission, $actor['permissions'] ?? [], true);
    }

    private function validatedPermissions(string $raw): array
    {
        $known = [];
        foreach (array_keys(self::MODULES) as $module) {
            foreach (['view', 'create', 'edit', 'delete'] as $action) {
                $known[] = $module . ':' . $action;
            }
        }
        foreach (['recordsMasterList', 'recordsTransfer'] as $module) {
            foreach (['view', 'create', 'edit', 'delete'] as $action) {
                $known[] = $module . ':' . $action;
            }
        }
        $permissions = array_values(array_unique(array_filter(array_map('trim', explode(',', $raw)))));
        foreach ($permissions as $permission) {
            if (!in_array($permission, $known, true)) {
                throw new \InvalidArgumentException('An unknown module permission was provided.');
            }
        }
        return $permissions;
    }

    private function publicUser(array $row, ?string $fullName = null, ?string $email = null): array
    {
        return [
            'id' => (int) $row['id'],
            'email' => $email ?? (string) $row['email'],
            'fullName' => $fullName ?? (string) $row['full_name'],
            'role' => (string) $row['role'],
            'office' => (string) $row['office'],
            'status' => (string) $row['status'],
            'permissions' => self::decodePermissions($row['permissions']),
        ];
    }

    private static function decodePermissions(string|array|null $permissions): array
    {
        if (is_array($permissions)) {
            return array_values(array_filter($permissions, 'is_string'));
        }
        if ($permissions === null || $permissions === '') {
            return [];
        }
        $decoded = json_decode($permissions, true);
        if (is_array($decoded)) {
            return array_values(array_filter($decoded, 'is_string'));
        }
        return array_values(array_filter(array_map('trim', explode(',', $permissions))));
    }

    private function verifyPassword(string $password, array $row): bool
    {
        $salt = (string) ($row['source_password_salt'] ?? '');
        if ($salt !== '') {
            return hash_equals((string) $row['password_hash'], hash('sha256', $password . $salt));
        }
        return password_verify($password, (string) $row['password_hash']);
    }

    private function recordPayload(array $input): array
    {
        $reserved = [
            'action', 'module', 'sheet', 'office', 'token', 'csrfToken',
            'idField', 'idValue', '_syncVersion', 'syncVersion',
        ];
        $data = [];
        foreach ($input as $key => $value) {
            if (!in_array($key, $reserved, true) && is_scalar($value)) {
                $data[$key] = (string) $value;
            }
        }
        unset($data['_syncVersion']);
        return $data;
    }

    private function findRecordForMutation(string $module, string $office, array $input): array
    {
        $idField = (string) ($input['idField'] ?? '');
        $idValue = (string) ($input['idValue'] ?? '');
        $expectedVersion = (string) ($input['_syncVersion'] ?? '');
        if ($idField === '' || $idValue === '' || $expectedVersion === '') {
            throw new \DomainException('This record was not loaded with a version token. Reload it before changing it.');
        }
        $statement = $this->db->prepare(
            'SELECT id, record_data FROM records WHERE module = :module AND office = :office ORDER BY id'
        );
        $statement->execute(['module' => $module, 'office' => $office]);
        $matches = [];
        foreach ($statement->fetchAll() as $row) {
            $record = json_decode($row['record_data'], true, 512, JSON_THROW_ON_ERROR);
            if (is_array($record) && array_key_exists($idField, $record)
                && (string) $record[$idField] === $idValue
                && hash_equals($expectedVersion, $this->recordVersion($record))) {
                $matches[] = $row;
            }
        }
        if (count($matches) === 0) {
            throw new \DomainException('The record changed or no longer exists. Reload it before trying again.');
        }
        if (count($matches) > 1) {
            throw new \DomainException('More than one record matches this identifier. Ask an administrator to resolve the duplicate.');
        }
        return $matches[0];
    }

    private function recordVersion(array $record): string
    {
        unset($record['_syncVersion']);
        return hash('sha256', json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
    }

    private function hasData(array $record): bool
    {
        foreach ($record as $value) {
            if (trim((string) $value) !== '') {
                return true;
            }
        }
        return false;
    }

    private function statusCategory(string $value): string
    {
        $status = mb_strtolower(trim($value));
        if ($status === '') {
            return '';
        }
        if (preg_match('/complete|closed|released|accomplished|denied/', $status)) {
            return 'Completed';
        }
        if (preg_match('/pending|received|new|for review/', $status)) {
            return 'Pending';
        }
        if (preg_match('/process|ongoing|routed|assigned|awaiting|active/', $status)) {
            return 'In progress';
        }
        return 'Other';
    }
}
