<?php
declare(strict_types=1);

require_once __DIR__ . '/app/Controllers/PageController.php';
require_once __DIR__ . '/app/Core/Database.php';

ini_set('session.use_strict_mode', '1');
ini_set('session.gc_maxlifetime', '28800');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Strict');
session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Strict',
    'path' => '/',
]);
session_start();

(new App\Controllers\PageController(App\Core\Database::connection()))->render((string) ($_GET['page'] ?? 'index'));
