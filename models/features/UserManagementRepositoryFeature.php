<?php
declare(strict_types=1);

namespace App\Models;

trait UserManagementRepositoryFeature
{
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
        if ($actor['role'] !== 'SuperAdmin'
            && in_array(self::CROSS_OFFICE_READ_PERMISSION, $permissions, true)) {
            throw new \DomainException('Only a Super Admin can grant cross-office read access.');
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
        $currentPermissions = self::decodePermissions($target['permissions']);
        $permissions = $this->validatedPermissions((string) ($input['permissions'] ?? implode(',', $currentPermissions)));
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
        if ($actor['role'] !== 'SuperAdmin'
            && in_array(self::CROSS_OFFICE_READ_PERMISSION, $permissions, true)
            && !in_array(self::CROSS_OFFICE_READ_PERMISSION, $currentPermissions, true)) {
            throw new \DomainException('Only a Super Admin can grant cross-office read access.');
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

    private function validatedPermissions(string $raw): array
    {
        $known = [];
        foreach (self::PERMISSION_MODULES as $module) {
            foreach (['view', 'create', 'edit', 'delete'] as $action) {
                $known[] = $module . ':' . $action;
            }
        }
        $known[] = self::CROSS_OFFICE_READ_PERMISSION;
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
}
