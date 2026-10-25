# DHSUD-CAR Records Shelter

The Shelter is being migrated to PHP MVC with **MySQL as the authoritative database**. PHP handles authentication, sessions, permissions, record and account CRUD, dashboard statistics, and activity history. Google Sheets is an optional one-way mirror: a successful MySQL write is committed first, then its latest snapshot is queued for Apps Script. Editing a spreadsheet does not update MySQL.

The application uses a PHP MVC structure: `index.php` routes requests through the page controller, controllers and models handle application logic and MySQL access, and PHP templates in `views/pages/` render each page. The MySQL API action handlers are grouped by feature in `controllers/features/`, and `ShelterRepository` composes its authentication, user, record, dashboard, activity, and authorization methods from `models/features/` while keeping its existing public interface. Routes are extensionless (for example, `/foi`); previous `.html` links redirect to their PHP route for bookmark compatibility. Browser-side JavaScript remains for interactive tables and forms, while PHP owns routing, sessions, authorization, database access, and HTML rendering. The shared Vue 3 navigation and Tailwind CSS design system are compiled locally; the application does not need a frontend CDN or development server at runtime.

## Frontend build

Install and build the local frontend assets from the repository root:

```powershell
npm ci
npm run build
```

The build writes `dist/assets/app.js` and `dist/assets/app.css`. Rebuild after changing files in `frontend/src/`.

## Record tables

Incoming, outgoing, Dockets Issuances, and Dockets Mapping tables show a compact summary row that expands to display every data column from the corresponding workbook sheet, in the same order and with the same headings. The FOI table uses the same summary-and-expand pattern. Its row actions separately download the blank official FOI form or generate a filled PDF from that record for preview and printing. The generated form opens in an in-page preview; use its Print button after the preview loads. The filled-PDF action retrieves the template through a PHP endpoint with an explicit PDF content type. Application-only action controls remain separate. User and activity tables show their application fields. Tables show 10 rows per page by default, with controls to choose 25 or 50 rows. Search and filter changes return to the first page. Wide sheets scroll horizontally on desktop; on small screens each cell displays its column label.

## First-time database setup

1. Start Apache and MySQL in XAMPP.
2. Configure PHP's environment variables for the MySQL connection: `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. The local XAMPP defaults are `127.0.0.1`, `dhsud_shelter_app`, `root`, and an empty password. This separate database avoids changing the existing legacy `dhsud_car_records` tables during cutover.
3. Import [database/schema.sql](./database/schema.sql) using phpMyAdmin or the MySQL client. The schema creates the application tables and does not delete existing data.
4. Preview the workbook import from the repository root:

   ```powershell
   php database\migrate_workbook.php --dry-run
   ```

5. If the counts are correct and the target application tables are empty, import the workbook once:

   ```powershell
   php database\migrate_workbook.php --import
   ```

The importer reads `DHSUD-CAR Records Database.xlsx`, imports the record worksheets, user accounts, and historical activity entries, and deliberately does **not** import active workbook sessions. It refuses to overwrite populated target tables.

The current workbook has no office value for many records. The approved cutover policy assigns records without office metadata to the Administrative and Finance Office. Apply that policy after import:

```powershell
php database\assign_unassigned_records.php "--office=Administrative and Finance Office"
```

This updates only records whose office is empty and queues fresh MySQL snapshots for the spreadsheet mirror. Use the exact office name chosen for this deployment.

Imported accounts retain their legacy password hash and salt for verification. At the first successful login, the password is upgraded to PHP's password-hash format and the legacy salt is removed. New or changed passwords are stored using PHP password hashing.

The workbook contains credential hashes and salts. Keep it, database backups, and SQL exports private; do not commit or distribute them.

## Spreadsheet mirror setup

Spreadsheet synchronization is optional and disabled unless `DHSUD_SHEETS_MIRROR_ENABLED` is set to `1` in the PHP environment. When enabled, PHP retains unsynchronized, size-bounded snapshots in `spreadsheet_sync_queue` and retries them during later API requests.

1. Set `DHSUD_SHEETS_MIRROR_ENABLED` to `1` in the Apache/PHP environment to enable synchronization. Leave it unset or set it to `0` to pause synchronization; queued snapshots remain untouched, and new snapshots are not queued while disabled. Restart Apache after changing environment settings.
2. Set `DHSUD_APPS_SCRIPT_URL` in the Apache/PHP environment to the current Apps Script web-app URL.
3. Generate a long random secret locally. Configure the exact same value as:
   - PHP environment variable `DHSUD_MIRROR_SECRET`.
   - Apps Script project Script Property `DHSUD_MIRROR_SECRET`.
   Do not put the secret in this repository or in client-side JavaScript.
4. Replace the Apps Script project code with the repository's current `Code.gs` and deploy a new web-app version. The endpoint accepts only the authenticated `syncDatabaseMirror` action for writes; `doGet` directs reads to the PHP application.
5. After the MySQL import and mirror setup, seed the spreadsheet from MySQL:

   ```powershell
   php database\queue_spreadsheet_mirror.php
   ```

The seed command queues snapshots for all record modules, users, and activity. Spreadsheet user snapshots intentionally blank password hashes and salts. App users should read and write through this PHP application; edits made directly in Sheets are not authoritative and may be overwritten by the next MySQL snapshot.

If synchronization fails, inspect `spreadsheet_sync_queue.last_error` without selecting or sharing the `payload` column. An HTTP 200 response can still be an HTML error page rather than the JSON response expected by PHP; the queue error reports the final response content type. The Apps Script handler returns authorized mirror errors as JSON, including lock-acquisition failures. After changing `Code.gs`, save and deploy a new web-app version before retrying. Back up destination sheets before running the seed command again because initial snapshots replace mirrored rows below the headers.

## API and application

The API entry point is `api/index.php`; the page front controller is `index.php`; PHP templates live in `views/pages/`. Apache rewrites clean extensionless page URLs to `index.php`, and `controllers/PageController.php` dispatches only its declared routes, including whether each route requires authentication. Trailing slashes are canonicalized, and legacy `.html` links redirect to clean routes. PHP controllers, models, shared includes, and browser assets follow the ATI-RTC-style root layout (`controllers/`, `models/`, `includes/`, and `assets/css/`/`assets/js/`) while retaining DHSUD's namespaced, typed implementations.

| Method | Action | Purpose |
| --- | --- | --- |
| `GET` | `csrf` | Start a PHP session and return a CSRF token |
| `GET` | `session` | Validate the current MySQL-backed session |
| `POST` | `login`, `logout` | Authenticate against MySQL or end the session |
| `POST` | `updateOwnProfile` | Update the signed-in user's details |
| `GET` | `getDocuments`, `getDashboardStats` | Read records and dashboard counts from MySQL |
| `POST` | `save`, `update`, `delete` | Create, update, and delete MySQL records |
| `POST` | `listUsers`, `createUserAccount`, `updateUserAccount`, `deleteUserAccount` | Role-restricted account management |
| `POST` | `listActivity` | Read role-restricted activity history |

Mutating requests require the `X-CSRF-Token` header returned by `csrf` or `login`. PHP sessions and hashed session tokens are validated against MySQL. Record operations enforce role, office, module permissions, and record-version checks.

### Role-based access control

- **SuperAdmin** has full module access and can read records and dashboard statistics across all offices, as well as manage users and activity system-wide.
- **OfficeAdmin** can manage accounts and view activity only in their own office. They can grant module permissions to same-office accounts, but cannot create or promote anyone to SuperAdmin.
- **OfficeStaff** can access only the modules and actions explicitly granted in their account.
- In User Management, selecting **OfficeStaff** defaults to View on every listed module; **OfficeAdmin** defaults to all listed module actions; and **SuperAdmin** displays all module actions checked and locked. OfficeStaff and OfficeAdmin defaults can be adjusted before saving.
- Module grants use `module:view`, `module:create`, `module:edit`, and `module:delete`. The active PHP API modules are Incoming, Outgoing, Dockets Issuances, Dockets Mapping, and FOI. Records Master List and Records Transfer permission codes are retained for their corresponding module cards, but those destinations do not yet have PHP pages or API-backed record operations.

Module view grants control both the shared navigation and direct page access. Users must be signed in to access protected module pages; account management and activity history are limited to SuperAdmin and OfficeAdmin. By default, non-SuperAdmin record reads and writes are scoped to the actor's office. SuperAdmin can separately grant `records:all_offices:view` to let an account read records and dashboard statistics across offices for modules where it has `module:view`; changes remain restricted to the account's own office.

MySQL is the authoritative source for displayed records. Successful MySQL writes are not rolled back if the optional spreadsheet mirror is unavailable; the API reports a mirror warning and retries the queued MySQL snapshot later. Spreadsheet changes are never read back into MySQL, so historical division records must be imported into MySQL before they can appear in the application.
