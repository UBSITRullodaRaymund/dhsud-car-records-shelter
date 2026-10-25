<?php
declare(strict_types=1);

namespace App\Models;

trait AuthenticationRepositoryFeature
{
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

    public function createSession(int $userId, string $sessionHash): void
    {
        $statement = $this->db->prepare(
            'INSERT INTO auth_sessions (session_hash, user_id, expires_at)
             VALUES (:session_hash, :user_id, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 8 HOUR))'
        );
        $statement->execute([
            'session_hash' => $sessionHash,
            'user_id' => $userId,
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

    private function verifyPassword(string $password, array $row): bool
    {
        $salt = (string) ($row['source_password_salt'] ?? '');
        if ($salt !== '') {
            return hash_equals((string) $row['password_hash'], hash('sha256', $password . $salt));
        }
        return password_verify($password, (string) $row['password_hash']);
    }
}
