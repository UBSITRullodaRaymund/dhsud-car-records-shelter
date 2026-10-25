<?php
declare(strict_types=1);

namespace App\Controllers;

trait MySqlReadActions
{
    private function readAction(string $action, array $actor, array $input): array
    {
        if ($action === 'getDashboardStats') {
            return $this->repository->dashboardStats($actor, (string) ($input['office'] ?? ''));
        }
        if ($action === 'getDocuments') {
            $module = (string) ($input['module'] ?? '');
            $this->validateSheet($module, (string) ($input['sheet'] ?? ''));
            return $this->repository->listRecords($actor, $module, (string) ($input['office'] ?? ''));
        }
        if ($action === 'listUsers') {
            return $this->repository->listUsers($actor);
        }
        if ($action === 'listActivity') {
            return $this->repository->listActivity($actor);
        }
        throw new \InvalidArgumentException('Unknown read action.');
    }
}
