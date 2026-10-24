CREATE DATABASE IF NOT EXISTS `dhsud_shelter_app`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `dhsud_shelter_app`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(254) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `source_password_salt` VARCHAR(255) NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `role` VARCHAR(32) NOT NULL,
  `office` VARCHAR(255) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'Active',
  `permissions` JSON NOT NULL,
  `source_date_created` VARCHAR(100) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_office_idx` (`office`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auth_sessions` (
  `session_hash` CHAR(64) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_hash`),
  KEY `auth_sessions_expiry_idx` (`expires_at`),
  CONSTRAINT `auth_sessions_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `module` VARCHAR(40) NOT NULL,
  `source_sheet` VARCHAR(100) NOT NULL,
  `source_row` INT UNSIGNED NULL,
  `office` VARCHAR(255) NULL,
  `record_data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `records_source_row_unique` (`source_sheet`, `source_row`),
  KEY `records_module_office_idx` (`module`, `office`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NULL,
  `email` VARCHAR(254) NOT NULL DEFAULT '',
  `full_name` VARCHAR(255) NOT NULL DEFAULT '',
  `role` VARCHAR(32) NOT NULL DEFAULT '',
  `office` VARCHAR(255) NOT NULL DEFAULT '',
  `module` VARCHAR(40) NOT NULL DEFAULT '',
  `action` VARCHAR(80) NOT NULL,
  `record_id` VARCHAR(255) NOT NULL DEFAULT '',
  `occurred_at` DATETIME NULL,
  `source_timestamp` VARCHAR(100) NULL,
  PRIMARY KEY (`id`),
  KEY `activity_logs_office_idx` (`office`),
  KEY `activity_logs_occurred_idx` (`occurred_at`),
  CONSTRAINT `activity_logs_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `spreadsheet_records_mirror` (
  `module` VARCHAR(40) NOT NULL,
  `office` VARCHAR(255) NOT NULL,
  `record_key` VARCHAR(32) NOT NULL,
  `record_data` JSON NOT NULL,
  `synced_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`module`, `office`, `record_key`),
  KEY `spreadsheet_records_synced_idx` (`synced_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `spreadsheet_users_mirror` (
  `email` VARCHAR(254) NOT NULL,
  `office` VARCHAR(255) NOT NULL DEFAULT '',
  `user_data` JSON NOT NULL,
  `synced_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`email`),
  KEY `spreadsheet_users_office_idx` (`office`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `spreadsheet_activity_mirror` (
  `entry_key` CHAR(64) NOT NULL,
  `office` VARCHAR(255) NOT NULL DEFAULT '',
  `entry_data` JSON NOT NULL,
  `synced_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`entry_key`),
  KEY `spreadsheet_activity_office_idx` (`office`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `spreadsheet_sync_queue` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `kind` VARCHAR(24) NOT NULL,
  `module` VARCHAR(40) NOT NULL DEFAULT '',
  `payload` JSON NOT NULL,
  `attempts` INT UNSIGNED NOT NULL DEFAULT 0,
  `last_error` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `spreadsheet_sync_queue_created_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
