<?php
declare(strict_types=1);

namespace App\Controllers;

trait MySqlRecordActions
{
    private function createRecordAction(array $actor, array $input): array
    {
        $module = (string) ($input['module'] ?? '');
        $this->validateSheet($module, (string) ($input['sheet'] ?? ''));
        return $this->write(function () use ($actor, $input, $module): array {
            $result = $this->repository->createRecord($actor, $input);
            $this->repository->logActivity($actor, $module, 'Create', (string) ($input['recordId'] ?? $result['recordId'] ?? ''));
            $this->syncQueue->enqueueSnapshot('records', $module);
            $this->syncQueue->enqueueSnapshot('activity');
            return $result;
        });
    }

    private function mutateRecordAction(string $action, array $actor, array $input): array
    {
        $module = (string) ($input['module'] ?? '');
        $this->validateSheet($module, (string) ($input['sheet'] ?? ''));
        return $this->write(function () use ($actor, $input, $module, $action): array {
            $result = $action === 'update'
                ? $this->repository->updateRecord($actor, $input)
                : $this->repository->deleteRecord($actor, $input);
            $this->repository->logActivity(
                $actor,
                $module,
                $action === 'update' ? 'Edit' : 'Delete',
                (string) ($input['idValue'] ?? '')
            );
            $this->syncQueue->enqueueSnapshot('records', $module);
            $this->syncQueue->enqueueSnapshot('activity');
            return $result;
        });
    }
}
