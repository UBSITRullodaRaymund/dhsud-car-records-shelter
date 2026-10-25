<?php
declare(strict_types=1);

namespace App\Models;

trait AuthorizationRepositoryFeature
{
    public function requireModule(array $actor, string $module, string $permission): void
    {
        if (!isset(self::MODULES[$module])) {
            throw new \InvalidArgumentException('Unknown records module.');
        }
        if (!$this->hasPermission($actor, $module . ':' . $permission)) {
            throw new \DomainException('Forbidden: your account does not have permission for this action.');
        }
    }

    public function canViewModule(array $actor, string $module): bool
    {
        return in_array($module, self::PERMISSION_MODULES, true)
            && $this->hasPermission($actor, $module . ':view');
    }

    public function canAccessPage(array $actor, string $page): bool
    {
        if (in_array($page, ['users', 'activity-log'], true)) {
            return in_array($actor['role'] ?? '', ['SuperAdmin', 'OfficeAdmin'], true);
        }

        $pageModules = match ($page) {
            'incoming' => ['incoming'],
            'outgoing' => ['outgoing'],
            'dockets' => ['dockets'],
            'dockets-mapping' => ['docketsMapping'],
            'foi' => ['foi'],
            'documents' => ['incoming', 'outgoing', 'dockets'],
            'requests' => ['foi'],
            'records' => self::PERMISSION_MODULES,
            default => [],
        };

        if ($pageModules === []) {
            return true;
        }

        foreach ($pageModules as $module) {
            if ($this->canViewModule($actor, $module)) {
                return true;
            }
        }
        return false;
    }

    public function resolveOffice(array $actor, string $requestedOffice): string
    {
        if ($actor['role'] !== 'SuperAdmin') {
            return (string) $actor['office'];
        }
        if ($requestedOffice !== '' && in_array($requestedOffice, self::OFFICES, true)) {
            return $requestedOffice;
        }
        return (string) $actor['office'];
    }

    private function requireAdmin(array $actor): void
    {
        if (!in_array($actor['role'] ?? '', ['SuperAdmin', 'OfficeAdmin'], true)) {
            throw new \DomainException('Forbidden: administrator access is required.');
        }
    }

    private function hasPermission(array $actor, string $permission): bool
    {
        return ($actor['role'] ?? '') === 'SuperAdmin'
            || in_array($permission, $actor['permissions'] ?? [], true);
    }

    private function hasCrossOfficeRead(array $actor): bool
    {
        return ($actor['role'] ?? '') !== 'SuperAdmin'
            && $this->hasPermission($actor, self::CROSS_OFFICE_READ_PERMISSION);
    }

    private function canReadAllOffices(array $actor): bool
    {
        return ($actor['role'] ?? '') === 'SuperAdmin'
            || $this->hasCrossOfficeRead($actor);
    }
}
