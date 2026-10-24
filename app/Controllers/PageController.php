<?php
declare(strict_types=1);

namespace App\Controllers;

use PDO;

final class PageController
{
    public function __construct(private readonly PDO $db)
    {
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

        if (in_array($page, self::PROTECTED, true)) {
            $sessionHash = (string) ($_SESSION['auth_token_hash'] ?? '');
            $statement = $this->db->prepare(
                'SELECT 1 FROM auth_sessions s
                 JOIN users u ON u.id = s.user_id
                 WHERE s.session_hash = :session_hash
                   AND s.expires_at > CURRENT_TIMESTAMP
                   AND u.status = \'Active\'
                 LIMIT 1'
            );
            $statement->execute(['session_hash' => $sessionHash]);
            if ($sessionHash === '' || !$statement->fetchColumn()) {
                header('Location: login.html', true, 302);
                exit;
            }
        }

        require dirname(__DIR__, 2) . '/views/pages/' . $page . '.php';
        exit;
    }
}
