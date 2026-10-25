<?php
declare(strict_types=1);

namespace App\Models;

trait RecordRepositoryFeature
{
    public function listRecords(array $actor, string $module, string $office): array
    {
        $this->requireModule($actor, $module, 'view');
        if ($this->canReadAllOffices($actor)) {
            $statement = $this->db->prepare(
                'SELECT id, office, record_data FROM records WHERE module = :module ORDER BY id'
            );
            $statement->execute(['module' => $module]);
        } else {
            $office = $this->resolveOffice($actor, $office);
            $statement = $this->db->prepare(
                'SELECT id, office, record_data FROM records WHERE module = :module AND office = :office ORDER BY id'
            );
            $statement->execute(['module' => $module, 'office' => $office]);
        }
        $records = [];
        foreach ($statement->fetchAll() as $row) {
            $record = json_decode($row['record_data'], true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($record)) {
                continue;
            }
            $record['_syncVersion'] = $this->recordVersion($record);
            $record['_recordOffice'] = (string) $row['office'];
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

    private function recordPayload(array $input): array
    {
        $reserved = [
            'action', 'module', 'sheet', 'office', 'token', 'csrfToken',
            'idField', 'idValue', '_syncVersion', '_recordOffice', 'syncVersion',
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
}
