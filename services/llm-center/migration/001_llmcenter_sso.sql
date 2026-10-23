-- Production prefix is nz_. Run this only against the selected Runhive database.
CREATE TABLE IF NOT EXISTS `nz_llmcenter_sso_ticket` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ticket_hash` char(64) NOT NULL,
  `admin_id` bigint unsigned NOT NULL,
  `audience` varchar(32) NOT NULL,
  `parent_token_cipher` text NOT NULL,
  `expires_at` bigint unsigned NOT NULL,
  `consumed_at` bigint unsigned DEFAULT NULL,
  `session_handle_hash` char(64) DEFAULT NULL,
  `session_expires_at` bigint unsigned NOT NULL,
  `revoked` tinyint unsigned NOT NULL DEFAULT 0,
  `create_time` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_hash` (`ticket_hash`),
  UNIQUE KEY `session_handle_hash` (`session_handle_hash`),
  KEY `admin_expiry` (`admin_id`,`session_expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
