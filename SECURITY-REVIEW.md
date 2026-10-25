# Security Review

**Review date:** 2026-10-25  
**Scope:** Focused review of online deployment risks, including Dockets Mapping record rendering and web access to a tracked SQL backup. This was not a full infrastructure or deployment audit.

## Findings

| # | Severity | File | Lines | Finding | Confidence |
|---|----------|------|-------|---------|------------|
| 1 | HIGH | `dockets-mapping.js` | 226, 250, 254, 282 | Stored cross-site scripting (XSS): persisted category/project values are interpolated into HTML and an inline event handler. A crafted record can execute JavaScript when another user opens the affected repository view. | 9/10 |
| 2 | HIGH (conditional) | `ATI-RTC(deployed)/backups/weekly_backup_2025-12-08.sql.zip`; `.htaccess` | Archive: N/A; `.htaccess`: 13–15 | Potential public disclosure of a SQL backup containing user/password fields. The access rule denies `.sql` files but does not match `.sql.zip`. Exposure depends on whether the archive is under the production web root and whether Apache honors `.htaccess`. | 8/10 |

## Deployment assessment

Do not consider the application ready for public deployment until the stored-XSS issue is remediated and the backup archive is either moved outside the document root or verified inaccessible through the production web server. If the backup may already have been publicly accessible, investigate access logs and rotate any credentials contained in it.

This focused review does not establish whether production TLS, secrets, database/network access, PHP/Apache configuration, backups, or hosting controls are correctly configured. Those items need verification in the actual deployment environment before launch.
