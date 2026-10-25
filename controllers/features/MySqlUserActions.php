<?php
declare(strict_types=1);

namespace App\Controllers;

trait MySqlUserActions
{
    private function manageUserAction(string $action, array $actor, array $input): array
    {
        if ($action === 'createUserAccount') {
            return $this->write(function () use ($actor, $input): array {
                $result = $this->repository->createUser($actor, $input);
                $this->repository->logActivity($actor, 'users', 'Create Account', (string) ($input['email'] ?? ''));
                $this->syncQueue->enqueueSnapshot('users');
                $this->syncQueue->enqueueSnapshot('activity');
                return $result;
            });
        }
        if ($action === 'updateUserAccount') {
            return $this->write(function () use ($actor, $input): array {
                $result = $this->repository->updateUser($actor, $input);
                $this->repository->logActivity($actor, 'users', 'Update Account', (string) ($input['email'] ?? ''));
                $this->syncQueue->enqueueSnapshot('users');
                $this->syncQueue->enqueueSnapshot('activity');
                return $result;
            });
        }
        if ($action === 'deleteUserAccount') {
            return $this->write(function () use ($actor, $input): array {
                $result = $this->repository->deleteUser($actor, (string) ($input['email'] ?? ''));
                $this->repository->logActivity($actor, 'users', 'Delete Account', (string) ($input['email'] ?? ''));
                $this->syncQueue->enqueueSnapshot('users');
                $this->syncQueue->enqueueSnapshot('activity');
                return $result;
            });
        }
        if ($action === 'updateOwnProfile') {
            return $this->write(function () use ($actor, $input): array {
                $sessionHash = (string) ($_SESSION['auth_token_hash'] ?? '');
                $result = $this->repository->updateOwnProfile($actor, $input, $sessionHash);
                $updatedActor = array_merge($actor, $result['user']);
                $this->repository->logActivity($updatedActor, 'profile', 'Update Profile');
                $this->syncQueue->enqueueSnapshot('users');
                $this->syncQueue->enqueueSnapshot('activity');
                return $result;
            });
        }
        throw new \InvalidArgumentException('Unknown account action.');
    }
}
