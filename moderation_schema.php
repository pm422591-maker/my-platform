<?php
// moderation_schema.php — гарантує наявність таблиць та колонок для системи скарг/модерації.
// Підключається в усіх ендпоінтах модерації. Дешеві операції (CREATE / ALTER IF NOT EXISTS).

if (!function_exists('ensureModerationSchema')) {
    function ensureModerationSchema(PDO $pdo): void {

        // ── Таблиця скарг ───────────────────────────────────────────────
        // target_type: на що скарга (post / comment / account)
        // target_id:   id поста / коментаря / користувача
        // target_url:  пряме посилання на об'єкт скарги
        // reason_code: категорія порушення
        // reason_text: довільний опис підстав
        // status:      pending / reviewing / resolved / rejected
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS reports (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                reporter_id   INT          NOT NULL,
                target_type   ENUM('post','comment','account') NOT NULL,
                target_id     INT          NOT NULL,
                target_user_id INT         DEFAULT NULL,
                target_url    VARCHAR(500) DEFAULT NULL,
                reason_code   VARCHAR(60)  NOT NULL DEFAULT 'other',
                reason_text   VARCHAR(1000) DEFAULT NULL,
                content_snapshot TEXT      DEFAULT NULL,
                status        ENUM('pending','reviewing','resolved','rejected') NOT NULL DEFAULT 'pending',
                admin_id      INT          DEFAULT NULL,
                admin_note    VARCHAR(1000) DEFAULT NULL,
                action_taken  VARCHAR(60)  DEFAULT NULL,
                created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                resolved_at   TIMESTAMP    NULL DEFAULT NULL,
                KEY idx_status (status),
                KEY idx_target (target_type, target_id),
                KEY idx_target_user (target_user_id),
                KEY idx_reporter (reporter_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");

        // ── Журнал модераційних дій (повна історія для аудиту) ──────────
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS moderation_log (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                admin_id     INT          NOT NULL,
                target_user_id INT        DEFAULT NULL,
                report_id    INT          DEFAULT NULL,
                action       VARCHAR(60)  NOT NULL,
                details      VARCHAR(1000) DEFAULT NULL,
                created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_admin (admin_id),
                KEY idx_target_user (target_user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");

        // ── Повідомлення від адміністрації користувачу ──────────────────
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS admin_messages (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                user_id     INT          NOT NULL,
                admin_id    INT          NOT NULL,
                report_id   INT          DEFAULT NULL,
                subject     VARCHAR(200) DEFAULT NULL,
                body        VARCHAR(2000) NOT NULL,
                is_read     TINYINT(1)   NOT NULL DEFAULT 0,
                created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");

        // ── Додаткові колонки на users для ролей/санкцій ────────────────
        // Робимо ALTER лише якщо колонки ще немає (MySQL не має IF NOT EXISTS
        // для ADD COLUMN у старих версіях, тому перевіряємо через схему).
        $cols = [
            'is_admin'        => "ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0",
            'admin_pass_hash' => "ALTER TABLE users ADD COLUMN admin_pass_hash VARCHAR(255) DEFAULT NULL",
            'status'          => "ALTER TABLE users ADD COLUMN status ENUM('active','restricted','banned') NOT NULL DEFAULT 'active'",
            'restricted_until'=> "ALTER TABLE users ADD COLUMN restricted_until TIMESTAMP NULL DEFAULT NULL",
            'ban_reason'      => "ALTER TABLE users ADD COLUMN ban_reason VARCHAR(500) DEFAULT NULL",
            'warnings_count'  => "ALTER TABLE users ADD COLUMN warnings_count INT NOT NULL DEFAULT 0",
        ];

        $existing = [];
        $q = $pdo->query("
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
        ");
        foreach ($q->fetchAll(PDO::FETCH_COLUMN) as $c) {
            $existing[$c] = true;
        }
        foreach ($cols as $name => $sql) {
            if (!isset($existing[$name])) {
                try { $pdo->exec($sql); } catch (Exception $e) { /* колонка вже є — ігноруємо */ }
            }
        }
    }
}

/**
 * Перевіряє, що поточна сесія належить адміністратору, який пройшов
 * додаткову (другу) перевірку пароля. Якщо ні — віддає 403 і завершує.
 * Використовується в усіх admin-* ендпоінтах.
 */
if (!function_exists('requireAdmin')) {
    function requireAdmin(PDO $pdo): array {
        if (empty($_SESSION['user_id']) || empty($_SESSION['is_admin']) || empty($_SESSION['admin_verified'])) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Доступ заборонено']);
            exit;
        }
        $stmt = $pdo->prepare("SELECT id, username, is_admin FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([(int)$_SESSION['user_id']]);
        $admin = $stmt->fetch();
        if (!$admin || (int)$admin['is_admin'] !== 1) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Доступ заборонено']);
            exit;
        }
        return $admin;
    }
}
