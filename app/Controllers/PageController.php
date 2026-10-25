<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\ShelterRepository;
use PDO;

require_once dirname(__DIR__) . '/Models/ShelterRepository.php';

final class PageController
{
    private readonly ShelterRepository $repository;

    public function __construct(private readonly PDO $db)
    {
        $this->repository = new ShelterRepository($db);
    }

    private const PAGES = [
        'index',
        'login',
        'users',
        'profile',
        'activity-log',
        'documents',
        'incoming',
        'outgoing',
        'dockets',
        'dockets-mapping',
        'records',
        'requests',
        'foi',
    ];

    private const PROTECTED = [
        'users',
        'profile',
        'activity-log',
        'documents',
        'records',
        'requests',
        'incoming',
        'outgoing',
        'dockets',
        'dockets-mapping',
        'foi',
    ];

    public function render(string $page): never
    {
        if (!in_array($page, self::PAGES, true)) {
            http_response_code(404);
            require dirname(__DIR__, 2) . '/views/404.php';
            exit;
        }

        $sessionHash = (string) ($_SESSION['auth_token_hash'] ?? '');
        $navigationUser = $sessionHash === '' ? null : $this->repository->userBySessionHash($sessionHash);
        if (in_array($page, self::PROTECTED, true) && $navigationUser === null) {
            header('Location: login', true, 302);
            exit;
        }
        if ($navigationUser !== null && !$this->repository->canAccessPage($navigationUser, $page)) {
            http_response_code(403);
            require dirname(__DIR__, 2) . '/views/403.php';
            exit;
        }

        $userCanViewModule = fn (string $module): bool => $navigationUser !== null
            && $this->repository->canViewModule($navigationUser, $module);
        require dirname(__DIR__, 2) . '/views/pages/' . $page . '.php';
        exit;
    }
}
