# Security Review

**Review date:** 2026-10-25  
**Scope:** Focused review of online deployment risks in the DHSUD-CAR Records Shelter. `ATI-RTC(deployed)` is a separate, reference-only project in this repository workspace; it is not part of the DHSUD Shelter system being developed or reviewed. This was not a full infrastructure or deployment audit.

## Findings

| # | Severity | File | Lines | Finding | Confidence |
|---|----------|------|-------|---------|------------|
| 1 | HIGH | `dockets-mapping.js` | 226, 250, 254, 282 | Stored cross-site scripting (XSS): persisted category/project values are interpolated into HTML and an inline event handler. A crafted record can execute JavaScript when another user opens the affected repository view. | 9/10 |
| 2 | LOW (packaging risk only) | `ATI-RTC(deployed)/backups/weekly_backup_2025-12-08.sql.zip`; `.htaccess` | Archive: N/A; `.htaccess`: 13–15 | The reference-only ATI-RTC project contains a SQL backup with user/password fields. This is not a vulnerability in the DHSUD Shelter application. It is only a publication risk if the separate reference folder is mistakenly included in the deployed web root; the current `.htaccess` rule does not match `.sql.zip`. | 8/10 |

## Deployment assessment

Do not consider the DHSUD Shelter application ready for public deployment until the stored-XSS issue is remediated. Keep the separate `ATI-RTC(deployed)` reference project out of the production deployment package. The backup exposure is not applicable when that reference folder is excluded; if it may already have been publicly accessible, investigate access logs and rotate any credentials contained in it.

This focused review does not establish whether production TLS, secrets, database/network access, PHP/Apache configuration, backups, or hosting controls are correctly configured. Those items need verification in the actual deployment environment before launch.
