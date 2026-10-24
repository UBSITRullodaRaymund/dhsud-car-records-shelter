<?php
declare(strict_types=1);

use App\Core\Database;
use App\Core\GoogleSheetsBridge;
use App\Models\ShelterRepository;
use App\Models\SpreadsheetSyncQueue;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once dirname(__DIR__) . '/app/Core/Database.php';
require_once dirname(__DIR__) . '/app/Core/GoogleSheetsBridge.php';
require_once dirname(__DIR__) . '/app/Models/ShelterRepository.php';
require_once dirname(__DIR__) . '/app/Models/SpreadsheetSyncQueue.php';

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

    $queue = new SpreadsheetSyncQueue($db, new GoogleSheetsBridge());
    $db->beginTransaction();
    try {
        foreach (array_keys(ShelterRepository::MODULES) as $module) {
            $queue->enqueueSnapshot('records', $module);
        }
        $queue->enqueueSnapshot('users');
        $queue->enqueueSnapshot('activity');
        $db->commit();
    } catch (Throwable $exception) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $exception;
    }

    $result = $queue->processPending(20);
    fwrite(STDOUT, "Queued initial MySQL snapshots for records, users, and activity.\n");
    if ($result['warning'] !== '') {
        fwrite(STDOUT, $result['warning'] . "\n");
    } else {
        fwrite(STDOUT, sprintf("Spreadsheet snapshots synchronized: %d.\n", $result['synced']));
    }
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage() . "\n");
    exit(1);
}
