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

require_once dirname(__DIR__) . '/includes/Database.php';
require_once dirname(__DIR__) . '/includes/GoogleSheetsBridge.php';
require_once dirname(__DIR__) . '/models/ShelterRepository.php';
require_once dirname(__DIR__) . '/models/SpreadsheetSyncQueue.php';

$office = '';
foreach ($argv as $argument) {
    if (str_starts_with($argument, '--office=')) {
        $office = substr($argument, strlen('--office='));
        break;
    }
}

$offices = [
    'Administrative and Finance Office',
    'Housing Real Estate Development Regulation Office',
    'Homeowners Association and Community Development Office',
    'Environmental, Land Use and Urban Planning Office',
    'Public Housing and Settlement Division',
    'Office of the Regional Director',
];
if (!in_array($office, $offices, true)) {
    fwrite(STDERR, "Provide an exact office name with --office=\"...\".\n");
    exit(2);
}

try {
    $db = Database::connection();
    $queueTable = $db->query("SHOW TABLES LIKE 'spreadsheet_sync_queue'")->fetchColumn();
    if (!$queueTable) {
        throw new RuntimeException('Import database/schema.sql before assigning record offices.');
    }

    $queue = new SpreadsheetSyncQueue($db, new GoogleSheetsBridge());
    $db->beginTransaction();
    try {
        $statement = $db->prepare(
            "UPDATE records
             SET office = :office,
                 record_data = JSON_SET(record_data, '$.office', :office_json, '$.recordOffice', :record_office_json)
             WHERE office IS NULL OR office = ''"
        );
        $statement->execute([
            'office' => $office,
            'office_json' => $office,
            'record_office_json' => $office,
        ]);
        $assigned = $statement->rowCount();
        if ($assigned > 0) {
            foreach (array_keys(ShelterRepository::MODULES) as $module) {
                $queue->enqueueSnapshot('records', $module);
            }
        }
        $db->commit();
    } catch (Throwable $exception) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $exception;
    }

    fwrite(STDOUT, sprintf("Assigned %d records to %s.\n", $assigned, $office));
    if ($assigned > 0) {
        $result = $queue->processPending();
        if ($result['warning'] !== '') {
            fwrite(STDOUT, $result['warning'] . "\n");
        }
    }
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage() . "\n");
    exit(1);
}
