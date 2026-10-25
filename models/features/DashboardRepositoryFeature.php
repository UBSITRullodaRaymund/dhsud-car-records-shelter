<?php
declare(strict_types=1);

namespace App\Models;

use PDO;

trait DashboardRepositoryFeature
{
    public function dashboardStats(array $actor, string $requestedOffice): array
    {
        $allOffices = $this->canReadAllOffices($actor);
        $office = $allOffices ? 'All offices' : $this->resolveOffice($actor, $requestedOffice);
        $modules = [];
        $totals = ['In progress' => 0, 'Pending' => 0, 'Completed' => 0, 'Other' => 0];
        foreach (self::MODULES as $module => $_sheet) {
            if (!$this->hasPermission($actor, $module . ':view')) {
                $modules[$module] = ['allowed' => false];
                continue;
            }
            if ($allOffices) {
                $statement = $this->db->prepare('SELECT record_data FROM records WHERE module = :module');
                $statement->execute(['module' => $module]);
            } else {
                $statement = $this->db->prepare('SELECT record_data FROM records WHERE module = :module AND office = :office');
                $statement->execute(['module' => $module, 'office' => $office]);
            }
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
