<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\GoogleSheetsBridge;
use PDO;

final class SpreadsheetSyncQueue
{
    private const MAX_CHUNK_BYTES = 393216;

    public function __construct(
        private readonly PDO $db,
        private readonly GoogleSheetsBridge $bridge
    ) {
    }

    public function enqueueSnapshot(string $kind, string $module = ''): void
    {
        $payload = match ($kind) {
            'records' => $this->recordsSnapshot($module),
            'users' => $this->usersSnapshot(),
            'activity' => $this->activitySnapshot(),
            default => throw new \InvalidArgumentException('Unsupported spreadsheet mirror type.'),
        };
        $chunks = $this->chunkSnapshot($kind, $payload);
        $replace = $this->db->prepare(
            'DELETE FROM spreadsheet_sync_queue WHERE kind = :kind AND module = :module'
        );
        $replace->execute(['kind' => $kind, 'module' => $module]);
        $statement = $this->db->prepare(
            'INSERT INTO spreadsheet_sync_queue (kind, module, payload) VALUES (:kind, :module, :payload)'
        );
        foreach ($chunks as $chunk) {
            $statement->execute([
                'kind' => $kind,
                'module' => $module,
                'payload' => json_encode($chunk, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            ]);
        }
    }

    public function processPending(int $limit = 10): array
    {
        $secret = getenv('DHSUD_MIRROR_SECRET') ?: '';
        if ($secret === '') {
            return ['synced' => 0, 'warning' => 'Spreadsheet mirror is not configured; set DHSUD_MIRROR_SECRET in PHP and Apps Script.'];
        }

        $statement = $this->db->prepare(
            'SELECT id, kind, module, payload FROM spreadsheet_sync_queue ORDER BY id LIMIT :limit'
        );
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->execute();
        $synced = 0;
        $failed = false;
        foreach ($statement->fetchAll() as $item) {
            try {
                $result = $this->bridge->request('POST', [
                    'action' => 'syncDatabaseMirror',
                    'secret' => $secret,
                    'kind' => $item['kind'],
                    'module' => $item['module'],
                    'payload' => $item['payload'],
                ]);
                if (empty($result['success'])) {
                    throw new \RuntimeException((string) ($result['error'] ?? 'Apps Script rejected the mirror update.'));
                }
                $delete = $this->db->prepare('DELETE FROM spreadsheet_sync_queue WHERE id = :id');
                $delete->execute(['id' => $item['id']]);
                $synced++;
            } catch (\Throwable $exception) {
                $failed = true;
                error_log('MySQL-to-spreadsheet mirror update failed: ' . $exception->getMessage());
                $update = $this->db->prepare(
                    'UPDATE spreadsheet_sync_queue SET attempts = attempts + 1, last_error = :last_error WHERE id = :id'
                );
                $update->execute([
                    'last_error' => mb_substr($exception->getMessage(), 0, 1000),
                    'id' => $item['id'],
                ]);
                break;
            }
        }

        return [
            'synced' => $synced,
            'warning' => $failed ? 'MySQL is up to date, but the spreadsheet mirror has pending changes and will be retried.' : '',
        ];
    }

    private function recordsSnapshot(string $module): array
    {
        if (!isset(ShelterRepository::MODULES[$module])) {
            throw new \InvalidArgumentException('Unknown records module for spreadsheet mirror.');
        }
        $statement = $this->db->prepare(
            'SELECT office, record_data FROM records WHERE module = :module ORDER BY id'
        );
        $statement->execute(['module' => $module]);
        $records = [];
        foreach ($statement->fetchAll() as $row) {
            $record = json_decode($row['record_data'], true, 512, JSON_THROW_ON_ERROR);
            if (is_array($record)) {
                $records[] = [
                    'office' => (string) ($row['office'] ?? ''),
                    'data' => $record,
                ];
            }
        }
        return ['records' => $records];
    }

    private function usersSnapshot(): array
    {
        $statement = $this->db->query(
            'SELECT email, full_name, role, office, status, permissions,
                    COALESCE(source_date_created, created_at) AS date_created
             FROM users ORDER BY id'
        );
        $users = [];
        foreach ($statement->fetchAll() as $row) {
            $users[] = [
                'email' => $row['email'],
                'fullName' => $row['full_name'],
                'role' => $row['role'],
                'office' => $row['office'],
                'status' => $row['status'],
                'permissions' => json_decode($row['permissions'], true, 512, JSON_THROW_ON_ERROR),
                'dateCreated' => $row['date_created'],
            ];
        }
        return ['users' => $users];
    }

    private function activitySnapshot(): array
    {
        $statement = $this->db->query(
            'SELECT email, full_name, role, office, module, action, record_id, occurred_at
             FROM activity_logs ORDER BY id'
        );
        $activity = [];
        foreach ($statement->fetchAll() as $row) {
            $activity[] = [
                'Email' => $row['email'],
                'FullName' => $row['full_name'],
                'Role' => $row['role'],
                'Office' => $row['office'],
                'Module' => $row['module'],
                'Action' => $row['action'],
                'RecordId' => $row['record_id'],
                'Timestamp' => $row['occurred_at'] ?? '',
            ];
        }
        return ['activity' => $activity];
    }

    private function chunkSnapshot(string $kind, array $snapshot): array
    {
        $key = match ($kind) {
            'records' => 'records',
            'users' => 'users',
            'activity' => 'activity',
        };
        $rows = $snapshot[$key];
        $chunks = [];
        $current = [];
        $currentOffsets = [];
        $offsets = [];
        $startIndex = 0;

        foreach ($rows as $row) {
            $candidate = [...$current, $row];
            $candidatePayload = $this->chunkPayload(
                $kind,
                $candidate,
                $currentOffsets,
                $startIndex,
                count($chunks)
            );
            $candidateJson = json_encode($candidatePayload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            if ($current === [] && strlen($candidateJson) > self::MAX_CHUNK_BYTES) {
                throw new \LengthException('A single spreadsheet mirror row exceeds the safe sync chunk size.');
            }
            if ($current !== [] && strlen($candidateJson) > self::MAX_CHUNK_BYTES) {
                $chunks[] = $this->chunkPayload(
                    $kind,
                    $current,
                    $currentOffsets,
                    $startIndex,
                    count($chunks)
                );
                $this->advanceOffsets($kind, $current, $offsets);
                $startIndex += count($current);
                $current = [$row];
                $currentOffsets = $offsets;
                continue;
            }
            $current = $candidate;
        }

        if ($current !== [] || $chunks === []) {
            $chunks[] = $this->chunkPayload(
                $kind,
                $current,
                $currentOffsets,
                $startIndex,
                count($chunks)
            );
        }

        $count = count($chunks);
        foreach ($chunks as $index => &$chunk) {
            $chunk['chunkIndex'] = $index;
            $chunk['chunkCount'] = $count;
        }
        unset($chunk);

        return $chunks;
    }

    private function chunkPayload(
        string $kind,
        array $rows,
        array $offsets,
        int $startIndex,
        int $chunkIndex
    ): array {
        return match ($kind) {
            'records' => [
                'records' => $rows,
                'offsetsByOffice' => $offsets,
                'chunkIndex' => $chunkIndex,
            ],
            'users' => [
                'users' => $rows,
                'startIndex' => $startIndex,
                'chunkIndex' => $chunkIndex,
            ],
            'activity' => [
                'activity' => $rows,
                'startIndex' => $startIndex,
                'chunkIndex' => $chunkIndex,
            ],
        };
    }

    private function advanceOffsets(string $kind, array $rows, array &$offsets): void
    {
        if ($kind !== 'records') {
            return;
        }
        foreach ($rows as $row) {
            $office = trim((string) ($row['office'] ?? ''));
            $key = in_array($office, ShelterRepository::OFFICES, true) ? $office : '__unassigned';
            $offsets[$key] = ($offsets[$key] ?? 0) + 1;
        }
    }
}
