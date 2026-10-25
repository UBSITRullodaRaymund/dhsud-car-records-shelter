<?php
declare(strict_types=1);

use App\Core\Database;
use App\Core\GoogleSheetsBridge;
use App\Core\Http;
use App\Controllers\MySqlApiController;
use App\Models\ShelterRepository;
use App\Models\SpreadsheetSyncQueue;

require_once dirname(__DIR__) . '/includes/Database.php';
require_once dirname(__DIR__) . '/includes/Http.php';
require_once dirname(__DIR__) . '/includes/GoogleSheetsBridge.php';
require_once dirname(__DIR__) . '/models/ShelterRepository.php';
require_once dirname(__DIR__) . '/models/SpreadsheetSyncQueue.php';
require_once dirname(__DIR__) . '/controllers/MySqlApiController.php';

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

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

try {
    $db = Database::connection();
    $db->exec(
        'CREATE TABLE IF NOT EXISTS spreadsheet_sync_queue (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            kind VARCHAR(24) NOT NULL,
            module VARCHAR(40) NOT NULL DEFAULT \'\',
            payload JSON NOT NULL,
            attempts INT UNSIGNED NOT NULL DEFAULT 0,
            last_error TEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY spreadsheet_sync_queue_created_idx (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $bridge = new GoogleSheetsBridge();
    $controller = new MySqlApiController(
        $db,
        new ShelterRepository($db),
        new SpreadsheetSyncQueue($db, $bridge)
    );
    $controller->dispatch();
} catch (Throwable $exception) {
    error_log('DHSUD MySQL API error: ' . $exception->getMessage());
    Http::json(['error' => 'The database service is unavailable. Check the PHP server log for details.'], 500);
}
