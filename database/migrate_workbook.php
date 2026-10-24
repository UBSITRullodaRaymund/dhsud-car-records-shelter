<?php
declare(strict_types=1);

final class WorkbookMigration
{
    private const RECORD_SHEETS = [
        'Incoming Documents' => 'incoming',
        'Outgoing Documents' => 'outgoing',
        'Dockets Issuances' => 'dockets',
        'Dockets Mapping' => 'docketsMapping',
        'FOI' => 'foi',
    ];

    private const OFFICES = [
        'Administrative and Finance Office',
        'Housing Real Estate Development Regulation Office',
        'Homeowners Association and Community Development Office',
        'Environmental, Land Use and Urban Planning Office',
        'Public Housing and Settlement Division',
        'Office of the Regional Director',
    ];

    private array $sharedStrings = [];
    private array $sheetPaths = [];

    public function __construct(private readonly string $workbookPath)
    {
        if (!class_exists(ZipArchive::class)) {
            throw new RuntimeException('PHP ZipArchive is required to read the workbook.');
        }
        if (!is_file($workbookPath)) {
            throw new RuntimeException('Workbook file not found: ' . $workbookPath);
        }

        $this->loadWorkbookIndex();
    }

    public function dryRun(): array
    {
        $summary = [];
        foreach ($this->sheetPaths as $name => $path) {
            $rows = $this->readRows($path);
            if ($rows === []) {
                $summary[$name] = $name === 'Sessions' ? '0 rows will be ignored' : 0;
                continue;
            }

            $headerRow = array_key_first($rows);
            $headers = $rows[$headerRow];
            unset($rows[$headerRow]);

            if (isset(self::RECORD_SHEETS[$name])) {
                $module = self::RECORD_SHEETS[$name];
                $summary[$name] = count(array_filter(
                    $rows,
                    fn (array $row): bool => $this->recordData($headers, $row, $module) !== []
                ));
            } elseif ($name === 'Users') {
                $headerMap = [];
                foreach ($headers as $index => $header) {
                    $headerMap[mb_strtolower(trim((string) $header))] = $index;
                }
                $summary[$name] = count(array_filter(
                    $rows,
                    static fn (array $row): bool =>
                        trim((string) ($row[$headerMap['email'] ?? -1] ?? '')) !== ''
                        && trim((string) ($row[$headerMap['passwordhash'] ?? -1] ?? '')) !== ''
                ));
            } elseif ($name === 'ActivityLog') {
                $headerMap = [];
                foreach ($headers as $index => $header) {
                    $headerMap[mb_strtolower(trim((string) $header))] = $index;
                }
                $summary[$name] = count(array_filter(
                    $rows,
                    static fn (array $row): bool =>
                        trim((string) ($row[$headerMap['email'] ?? -1] ?? '')) !== ''
                        || trim((string) ($row[$headerMap['action'] ?? -1] ?? '')) !== ''
                ));
            } elseif ($name === 'Sessions') {
                $ignored = count(array_filter(
                    $rows,
                    static fn (array $row): bool => count(array_filter($row, static fn (string $value): bool => trim($value) !== '')) > 0
                ));
                $summary[$name] = $ignored . ' rows will be ignored (active sessions are invalidated)';
            }
        }

        return $summary;
    }

    public function import(PDO $db): array
    {
        $this->assertEmptyTarget($db);
        $counts = ['records' => 0, 'users' => 0, 'activity_logs' => 0];
        $db->beginTransaction();

        try {
            foreach (self::RECORD_SHEETS as $sheetName => $module) {
                if (!isset($this->sheetPaths[$sheetName])) {
                    throw new RuntimeException('Workbook is missing sheet: ' . $sheetName);
                }
                $rows = $this->readRows($this->sheetPaths[$sheetName]);
                if ($rows === []) {
                    continue;
                }
                $headerRow = array_key_first($rows);
                $headers = $rows[$headerRow];
                unset($rows[$headerRow]);
                $insert = $db->prepare(
                    'INSERT INTO records (module, source_sheet, source_row, office, record_data)
                     VALUES (:module, :source_sheet, :source_row, :office, :record_data)'
                );

                foreach ($rows as $rowNumber => $row) {
                    $data = $this->recordData($headers, $row, $module);
                    if ($data === []) {
                        continue;
                    }
                    $office = $this->recordOffice($data);
                    $insert->execute([
                        'module' => $module,
                        'source_sheet' => $sheetName,
                        'source_row' => $rowNumber,
                        'office' => $office,
                        'record_data' => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                    ]);
                    $counts['records']++;
                }
            }

            if (isset($this->sheetPaths['Users'])) {
                $counts['users'] = $this->importUsers($db, $this->readRows($this->sheetPaths['Users']));
            }
            if (isset($this->sheetPaths['ActivityLog'])) {
                $counts['activity_logs'] = $this->importActivity($db, $this->readRows($this->sheetPaths['ActivityLog']));
            }

            $db->commit();
        } catch (Throwable $exception) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $exception;
        }

        return $counts;
    }

    private function loadWorkbookIndex(): void
    {
        $zip = new ZipArchive();
        if ($zip->open($this->workbookPath) !== true) {
            throw new RuntimeException('Could not open the Excel workbook.');
        }

        $sharedXml = $zip->getFromName('xl/sharedStrings.xml');
        if ($sharedXml !== false) {
            $shared = $this->parseXml($sharedXml);
            foreach ($shared->xpath('//*[local-name()="si"]') ?: [] as $item) {
                $this->sharedStrings[] = $this->textValue($item);
            }
        }

        $workbook = $this->parseXml($zip->getFromName('xl/workbook.xml') ?: '');
        $relationships = $this->parseXml($zip->getFromName('xl/_rels/workbook.xml.rels') ?: '');
        $targets = [];
        foreach ($relationships->xpath('//*[local-name()="Relationship"]') ?: [] as $relationship) {
            $attributes = $relationship->attributes();
            $targets[(string) $attributes['Id']] = (string) $attributes['Target'];
        }

        foreach ($workbook->xpath('//*[local-name()="sheets"]/*[local-name()="sheet"]') ?: [] as $sheet) {
            $attributes = $sheet->attributes();
            $relationId = '';
            foreach ($sheet->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships') as $key => $value) {
                if ((string) $key === 'id') {
                    $relationId = (string) $value;
                    break;
                }
            }
            if ($relationId === '' || !isset($targets[$relationId])) {
                continue;
            }
            $target = ltrim($targets[$relationId], '/');
            $path = str_starts_with($target, 'xl/') ? $target : 'xl/' . $target;
            $this->sheetPaths[(string) $attributes['name']] = str_replace('xl/worksheets/../', 'xl/', $path);
        }

        $zip->close();
    }

    private function readRows(string $path): array
    {
        $zip = new ZipArchive();
        if ($zip->open($this->workbookPath) !== true) {
            throw new RuntimeException('Could not reopen the Excel workbook.');
        }
        $xml = $zip->getFromName($path);
        $zip->close();
        if ($xml === false) {
            throw new RuntimeException('Workbook worksheet could not be read.');
        }

        $sheet = $this->parseXml($xml);
        $rows = [];
        foreach ($sheet->xpath('//*[local-name()="sheetData"]/*[local-name()="row"]') ?: [] as $rowNode) {
            $rowAttributes = $rowNode->attributes();
            $rowNumber = (int) ($rowAttributes['r'] ?? (count($rows) + 1));
            $cells = [];
            foreach ($rowNode->xpath('./*[local-name()="c"]') ?: [] as $cell) {
                $attributes = $cell->attributes();
                $reference = (string) ($attributes['r'] ?? '');
                $column = $this->columnNumber($reference);
                if ($column < 0) {
                    continue;
                }
                $type = (string) ($attributes['t'] ?? '');
                $valueNodes = $cell->xpath('./*[local-name()="v"]');
                $value = isset($valueNodes[0]) ? (string) $valueNodes[0] : '';
                if ($type === 's' && $value !== '') {
                    $value = $this->sharedStrings[(int) $value] ?? '';
                } elseif ($type === 'inlineStr') {
                    $inline = $cell->xpath('./*[local-name()="is"]');
                    $value = isset($inline[0]) ? $this->textValue($inline[0]) : '';
                } elseif ($type === 'b') {
                    $value = $value === '1' ? 'TRUE' : 'FALSE';
                }
                $cells[$column] = $value;
            }
            if ($cells !== []) {
                ksort($cells);
                $rows[$rowNumber] = $cells;
            }
        }

        ksort($rows);
        $indexed = [];
        foreach ($rows as $number => $cells) {
            $indexed[$number] = $cells;
        }
        return $indexed;
    }

    private function importUsers(PDO $db, array $rows): int
    {
        if ($rows === []) {
            return 0;
        }
        $headers = array_shift($rows);
        $headerMap = [];
        foreach ($headers as $index => $header) {
            $headerMap[mb_strtolower(trim((string) $header))] = $index;
        }
        $required = ['email', 'passwordhash', 'salt', 'fullname', 'role', 'office', 'status', 'datecreated', 'permissions'];
        foreach ($required as $field) {
            if (!array_key_exists($field, $headerMap)) {
                throw new RuntimeException('Users worksheet is missing a required header.');
            }
        }

        $insert = $db->prepare(
            'INSERT INTO users
             (email, password_hash, source_password_salt, full_name, role, office, status, permissions, source_date_created)
             VALUES (:email, :password_hash, :salt, :full_name, :role, :office, :status, :permissions, :date_created)'
        );
        $count = 0;
        foreach ($rows as $row) {
            $get = static fn (string $field): string => trim((string) ($row[$headerMap[$field]] ?? ''));
            $email = mb_strtolower($get('email'));
            $hash = $get('passwordhash');
            if ($email === '' || $hash === '') {
                continue;
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                throw new RuntimeException('The Users worksheet contains an invalid email address.');
            }
            $role = $get('role');
            if (!in_array($role, ['SuperAdmin', 'OfficeAdmin', 'OfficeStaff'], true)) {
                throw new RuntimeException('The Users worksheet contains an unsupported role.');
            }
            $office = $get('office');
            if (!in_array($office, self::OFFICES, true)) {
                throw new RuntimeException('The Users worksheet contains an unsupported office.');
            }
            $permissions = array_values(array_filter(array_map('trim', explode(',', $get('permissions')))));
            $insert->execute([
                'email' => $email,
                'password_hash' => $hash,
                'salt' => $get('salt') ?: null,
                'full_name' => $get('fullname'),
                'role' => $role,
                'office' => $office,
                'status' => $get('status') ?: 'Active',
                'permissions' => json_encode($permissions, JSON_THROW_ON_ERROR),
                'date_created' => $get('datecreated') ?: null,
            ]);
            $count++;
        }

        return $count;
    }

    private function importActivity(PDO $db, array $rows): int
    {
        if ($rows === []) {
            return 0;
        }
        $headers = array_map(static fn ($header): string => mb_strtolower(trim((string) $header)), array_shift($rows));
        $indexes = array_flip($headers);
        $insert = $db->prepare(
            'INSERT INTO activity_logs
             (user_id, email, full_name, role, office, module, action, record_id, occurred_at, source_timestamp)
             VALUES (NULL, :email, :full_name, :role, :office, :module, :action, :record_id, NULL, :source_timestamp)'
        );
        $count = 0;
        foreach ($rows as $row) {
            $get = static fn (string $field): string => trim((string) ($row[$indexes[$field]] ?? ''));
            if ($get('email') === '' && $get('action') === '') {
                continue;
            }
            $insert->execute([
                'email' => $get('email'),
                'full_name' => $get('fullname'),
                'role' => $get('role'),
                'office' => $get('office'),
                'module' => $get('module'),
                'action' => $get('action') ?: 'Imported activity',
                'record_id' => $get('recordid'),
                'source_timestamp' => $get('timestamp') ?: null,
            ]);
            $count++;
        }

        return $count;
    }

    private function recordData(array $headers, array $row, string $module): array
    {
        $data = [];
        $occurrences = [];
        $hasValue = false;
        foreach ($headers as $column => $header) {
            $value = (string) ($row[$column] ?? '');
            $hasValue = $hasValue || trim($value) !== '';
            $sourceName = trim((string) $header);
            $compact = mb_strtolower((string) preg_replace('/[^a-z0-9]/i', '', $sourceName));
            if ($sourceName === '') {
                $key = $module === 'incoming' ? 'routingSlip' : 'column_' . ($column + 1);
            } else {
                $occurrence = $occurrences[$compact] ?? 0;
                $occurrences[$compact] = $occurrence + 1;
                $key = $this->fieldName($sourceName, $module, $occurrence);
            }
            if (array_key_exists($key, $data)) {
                $key .= '_' . ($column + 1);
            }
            $data[$key] = $value;
        }

        return $hasValue ? $data : [];
    }

    private function fieldName(string $header, string $module, int $occurrence): string
    {
        $compact = mb_strtolower((string) preg_replace('/[^a-z0-9]/i', '', $header));
        $common = [
            'transactionno' => $module === 'dockets' || $module === 'foi' ? 'transactionNo' : 'tracking',
            'transactionnumber' => $module === 'dockets' || $module === 'foi' ? 'transactionNo' : 'tracking',
            'routingslipno' => 'tracking',
            'trackingno' => 'tracking',
            'trackingnumber' => 'tracking',
            'datereceived' => 'dateReceived',
            'receiveddate' => 'dateReceived',
            'sender' => 'sender',
            'originatingoffice' => 'office',
            'originoffice' => 'office',
            'office' => 'office',
            'category' => 'category',
            'subject' => 'subject',
            'division' => 'division',
            'assigneddivision' => 'division',
            'ageing' => 'ageing',
            'status' => 'status',
            'remarks' => 'remarks',
            'filename' => 'fileName',
            'documentfile' => 'fileName',
            'driveurl' => 'driveUrl',
            'daterequest' => 'dateRequest',
            'documentname' => 'documentName',
            'classification' => 'classification',
            'requestedby' => 'requestedBy',
            'releasedby' => 'releasedBy',
            'datereturned' => 'dateReturned',
            'returnedby' => 'returnedBy',
            'verifiedby' => 'verifiedBy',
            'title' => 'title',
            'contactnoemail' => 'contactEmail',
            'modeofcommunication' => 'communicationMode',
            'typeofid' => 'idType',
            'agencyconnectingagency' => $occurrence > 0 ? 'accomplishedAgency' : 'agency',
            'titleofdocumentrecordrequested' => 'documentRequested',
            'dateperiod' => 'datePeriod',
            'purposeofrequest' => 'purpose',
            'documenttype' => 'documentType',
            'referenceno' => 'referenceNo',
            'additionalinformation' => 'additionalInformation',
            'dateaccomplished' => 'dateAccomplished',
            'dateenteredonefoi' => 'dateEnteredEfoi',
            'proofofidpresented' => 'proofOfId',
            'requestisrecommendedtobe' => 'recommendation',
            'ifdeniedreasondenial' => $occurrence > 0 ? 'decisionDenialReason' : 'denialReason',
            'secondreceivingofficerassigned' => 'secondOfficer',
            'decisiononapplication' => 'decision',
            'daterequestfinished' => 'dateFinished',
            'foiregistryaccomplished' => 'registryAccomplished',
        ];
        if (isset($common[$compact])) {
            return $common[$compact];
        }

        $words = preg_split('/[^a-z0-9]+/i', mb_strtolower($header), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if ($words === []) {
            return 'field';
        }

        $first = array_shift($words);
        return $first . implode('', array_map('ucfirst', $words));
    }

    private function recordOffice(array $data): ?string
    {
        foreach (['office', 'recordOffice'] as $key) {
            if (isset($data[$key]) && in_array(trim((string) $data[$key]), self::OFFICES, true)) {
                return trim((string) $data[$key]);
            }
        }

        return null;
    }

    private function assertEmptyTarget(PDO $db): void
    {
        foreach (['users', 'records', 'activity_logs', 'auth_sessions'] as $table) {
            $count = (int) $db->query('SELECT COUNT(*) FROM `' . $table . '`')->fetchColumn();
            if ($count > 0) {
                throw new RuntimeException('Target database already contains data in ' . $table . '; import was stopped to avoid overwriting it.');
            }
        }
    }

    private function parseXml(string $xml): SimpleXMLElement
    {
        if ($xml === '') {
            throw new RuntimeException('Workbook XML is missing or empty.');
        }
        $parsed = simplexml_load_string($xml, SimpleXMLElement::class, LIBXML_NONET);
        if ($parsed === false) {
            throw new RuntimeException('Workbook XML is invalid.');
        }

        return $parsed;
    }

    private function textValue(SimpleXMLElement $node): string
    {
        $texts = $node->xpath('.//*[local-name()="t"]') ?: [];
        if ($node->getName() === 't') {
            return (string) $node;
        }

        return implode('', array_map(static fn (SimpleXMLElement $text): string => (string) $text, $texts));
    }

    private function columnNumber(string $reference): int
    {
        preg_match('/^([A-Z]+)/i', $reference, $matches);
        if (!isset($matches[1])) {
            return -1;
        }
        $number = 0;
        foreach (str_split(strtoupper($matches[1])) as $letter) {
            $number = $number * 26 + ord($letter) - 64;
        }

        return $number - 1;
    }
}

$projectRoot = dirname(__DIR__);
$workbookPath = $projectRoot . DIRECTORY_SEPARATOR . 'DHSUD-CAR Records Database.xlsx';
$importRequested = in_array('--import', $argv, true);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

try {
    $migration = new WorkbookMigration($workbookPath);
    if (!$importRequested) {
        fwrite(STDOUT, "Dry run only. Add --import to write to MySQL.\n");
        foreach ($migration->dryRun() as $sheet => $rows) {
            fwrite(STDOUT, sprintf("%s: %s\n", $sheet, (string) $rows));
        }
        exit(0);
    }

    $host = getenv('DB_HOST') ?: '127.0.0.1';
    $name = getenv('DB_NAME') ?: 'dhsud_shelter_app';
    $user = getenv('DB_USER') ?: 'root';
    $password = getenv('DB_PASSWORD') ?: '';
    $db = new PDO(
        "mysql:host={$host};dbname={$name};charset=utf8mb4",
        $user,
        $password,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    $counts = $migration->import($db);
    fwrite(STDOUT, sprintf(
        "Imported %d records, %d user accounts, and %d activity entries. Existing Sessions rows were intentionally not imported.\n",
        $counts['records'],
        $counts['users'],
        $counts['activity_logs']
    ));
} catch (Throwable $exception) {
    fwrite(STDERR, 'Migration failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
