<?php
declare(strict_types=1);

namespace App\Models;

use PDO;

require_once __DIR__ . '/features/AuthenticationRepositoryFeature.php';
require_once __DIR__ . '/features/UserManagementRepositoryFeature.php';
require_once __DIR__ . '/features/RecordRepositoryFeature.php';
require_once __DIR__ . '/features/DashboardRepositoryFeature.php';
require_once __DIR__ . '/features/ActivityRepositoryFeature.php';
require_once __DIR__ . '/features/AuthorizationRepositoryFeature.php';

final class ShelterRepository
{
    use AuthenticationRepositoryFeature,
        UserManagementRepositoryFeature,
        RecordRepositoryFeature,
        DashboardRepositoryFeature,
        ActivityRepositoryFeature,
        AuthorizationRepositoryFeature;

    public const CROSS_OFFICE_READ_PERMISSION = 'records:all_offices:view';

    public const MODULES = [
        'incoming' => 'Incoming Documents',
        'outgoing' => 'Outgoing Documents',
        'dockets' => 'Dockets Issuances',
        'docketsMapping' => 'Dockets Mapping',
        'foi' => 'FOI',
    ];

    public const PERMISSION_MODULES = [
        'incoming',
        'outgoing',
        'dockets',
        'docketsMapping',
        'recordsMasterList',
        'recordsTransfer',
        'foi',
    ];

    public const OFFICES = [
        'Administrative and Finance Office',
        'Housing Real Estate Development Regulation Office',
        'Homeowners Association and Community Development Office',
        'Environmental, Land Use and Urban Planning Office',
        'Public Housing and Settlement Division',
        'Office of the Regional Director',
    ];

    public function __construct(private readonly PDO $db)
    {
    }
}
