<?php
declare(strict_types=1);

require_once __DIR__ . '/controllers/PageController.php';
require_once __DIR__ . '/includes/Database.php';

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

$route = (string) ($_GET['route'] ?? $_GET['page'] ?? 'index');
if (isset($_GET['legacy']) && preg_match('/^[a-z0-9-]+$/iD', $route)) {
    $scriptDirectory = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/index.php')));
    $basePath = rtrim($scriptDirectory, '/');
    $canonicalPath = $route === 'index' ? $basePath . '/' : $basePath . '/' . $route;
    header('Location: ' . $canonicalPath, true, 301);
    exit;
}

(new App\Controllers\PageController(App\Core\Database::connection()))->render($route);
