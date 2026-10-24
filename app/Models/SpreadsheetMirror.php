<?php
declare(strict_types=1);

namespace App\Models;

use PDO;

final class SpreadsheetMirror
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function records(string $module, string $office, array $records): void
    {
        $this->db->beginTransaction();
        try {
            $delete = $this->db->prepare(
                'DELETE FROM spreadsheet_records_mirror WHERE module = :module AND office = :office'
            );
            $delete->execute(['module' => $module, 'office' => $office]);
            foreach (array_chunk($records, 200, true) as $batch) {
                $values = [];
                $parameters = [];
                foreach ($batch as $index => $record) {
                    $values[] = '(?, ?, ?, ?, CURRENT_TIMESTAMP)';
                    array_push(
                        $parameters,
                        $module,
                        $office,
                        (string) $index,
                        json_encode($record, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)
                    );
                }
                $insert = $this->db->prepare(
                    'INSERT INTO spreadsheet_records_mirror (module, office, record_key, record_data, synced_at)
                     VALUES ' . implode(', ', $values)
                );
                $insert->execute($parameters);
            }
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    public function users(array $users, string $role, string $office): void
    {
        $this->db->beginTransaction();
        try {
            if ($role === 'SuperAdmin') {
                $this->db->exec('DELETE FROM spreadsheet_users_mirror');
            } else {
                $delete = $this->db->prepare('DELETE FROM spreadsheet_users_mirror WHERE office = :office');
                $delete->execute(['office' => $office]);
            }
            $insert = $this->db->prepare(
                'INSERT INTO spreadsheet_users_mirror (email, office, user_data, synced_at)
                 VALUES (:email, :office, :user_data, CURRENT_TIMESTAMP)'
                . ' ON DUPLICATE KEY UPDATE office = VALUES(office), user_data = VALUES(user_data), synced_at = CURRENT_TIMESTAMP'
            );
            foreach ($users as $user) {
                if (!is_array($user) || empty($user['email'])) {
                    continue;
                }
                $insert->execute([
                    'email' => mb_strtolower((string) $user['email']),
                    'office' => (string) ($user['office'] ?? ''),
                    'user_data' => json_encode($user, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                ]);
            }
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    public function updateUserProfile(string $previousEmail, array $user): void
    {
        $email = mb_strtolower((string) ($user['email'] ?? ''));
        if ($email === '') {
            throw new \InvalidArgumentException('A profile email is required to update the users mirror.');
        }

        $this->db->beginTransaction();
        try {
            $delete = $this->db->prepare(
                'DELETE FROM spreadsheet_users_mirror WHERE email = :previous_email OR email = :email'
            );
            $delete->execute([
                'previous_email' => mb_strtolower($previousEmail),
                'email' => $email,
            ]);

            $insert = $this->db->prepare(
                'INSERT INTO spreadsheet_users_mirror (email, office, user_data, synced_at)
                 VALUES (:email, :office, :user_data, CURRENT_TIMESTAMP)'
            );
            $insert->execute([
                'email' => $email,
                'office' => (string) ($user['office'] ?? ''),
                'user_data' => json_encode($user, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            ]);
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    public function activity(array $logs, string $role, string $office): void
    {
        $this->db->beginTransaction();
        try {
            if ($role === 'SuperAdmin') {
                $this->db->exec('DELETE FROM spreadsheet_activity_mirror');
            } else {
                $delete = $this->db->prepare('DELETE FROM spreadsheet_activity_mirror WHERE office = :office');
                $delete->execute(['office' => $office]);
            }
            $insert = $this->db->prepare(
                'INSERT INTO spreadsheet_activity_mirror (entry_key, office, entry_data, synced_at)
                 VALUES (:entry_key, :office, :entry_data, CURRENT_TIMESTAMP)'
                . ' ON DUPLICATE KEY UPDATE office = VALUES(office), entry_data = VALUES(entry_data), synced_at = CURRENT_TIMESTAMP'
            );
            foreach ($logs as $index => $log) {
                if (!is_array($log)) {
                    continue;
                }
                $insert->execute([
                    'entry_key' => hash('sha256', json_encode([$index, $log], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)),
                    'office' => (string) ($log['Office'] ?? $log['office'] ?? ''),
                    'entry_data' => json_encode($log, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                ]);
            }
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }
}
