<?php
// applications_schema.php — гарантує наявність таблиці post_applications.
// Підключається в усіх ендпоінтах заявок. Дешева операція (CREATE IF NOT EXISTS).

if (!function_exists('ensureApplicationsTable')) {
    function ensureApplicationsTable(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS post_applications (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                post_id      INT NOT NULL,
                owner_id     INT NOT NULL,
                applicant_id INT NOT NULL,
                comment      VARCHAR(500) DEFAULT NULL,
                status       ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
                is_read      TINYINT(1) NOT NULL DEFAULT 0,
                created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_post_applicant (post_id, applicant_id),
                KEY idx_owner (owner_id),
                KEY idx_applicant (applicant_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
    }
}
