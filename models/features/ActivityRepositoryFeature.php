<?php
declare(strict_types=1);

namespace App\Models;

trait ActivityRepositoryFeature
{
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
}
