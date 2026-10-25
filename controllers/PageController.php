<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\ShelterRepository;
use PDO;

require_once dirname(__DIR__) . '/models/ShelterRepository.php';

final class PageController
{
    private readonly ShelterRepository $repository;

    public function __construct(private readonly PDO $db)
    {
        $this->repository = new ShelterRepository($db);
    }

    private const ROUTES = [
        'index' => ['view' => 'index.php', 'protected' => false],
        'login' => ['view' => 'login.php', 'protected' => false],
        'users' => ['view' => 'users.php', 'protected' => true],
        'profile' => ['view' => 'profile.php', 'protected' => true],
        'activity-log' => ['view' => 'activity-log.php', 'protected' => true],
        'documents' => ['view' => 'documents.php', 'protected' => true],
        'incoming' => ['view' => 'incoming.php', 'protected' => true],
        'outgoing' => ['view' => 'outgoing.php', 'protected' => true],
        'dockets' => ['view' => 'dockets.php', 'protected' => true],
        'dockets-mapping' => ['view' => 'dockets-mapping.php', 'protected' => true],
        'records' => ['view' => 'records.php', 'protected' => true],
        'requests' => ['view' => 'requests.php', 'protected' => true],
        'foi' => ['view' => 'foi.php', 'protected' => true],
    ];

    public function render(string $page): never
    {
        $route = self::ROUTES[$page] ?? null;
        if ($route === null) {
            http_response_code(404);
            require dirname(__DIR__) . '/views/404.php';
            exit;
        }

        $sessionHash = (string) ($_SESSION['auth_token_hash'] ?? '');
        $navigationUser = $sessionHash === '' ? null : $this->repository->userBySessionHash($sessionHash);
        if ($route['protected'] && $navigationUser === null) {
            header('Location: login', true, 302);
            exit;
        }
        if ($navigationUser !== null && !$this->repository->canAccessPage($navigationUser, $page)) {
            http_response_code(403);
            require dirname(__DIR__) . '/views/403.php';
            exit;
        }

        $userCanViewModule = fn (string $module): bool => $navigationUser !== null
            && $this->repository->canViewModule($navigationUser, $module);
        require dirname(__DIR__) . '/views/pages/' . $route['view'];
        exit;
    }
}
