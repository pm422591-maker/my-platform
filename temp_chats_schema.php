<?php
if (!function_exists('ensureTempChatsTable')) {
    function ensureTempChatsTable(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS temp_chats (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                user_a      INT NOT NULL,            -- власник анкети
                user_b      INT NOT NULL,            -- той, хто відгукнувся
                post_id     INT DEFAULT NULL,
                expires_at  DATETIME NOT NULL,       -- коли чат згорає
                extend_a    TINYINT(1) NOT NULL DEFAULT 0,  -- user_a natysnuv prodovzhyty
                extend_b    TINYINT(1) NOT NULL DEFAULT 0,  -- user_b natysnuv prodovzhyty
                created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_pair (user_a, user_b),
                KEY idx_a (user_a),
                KEY idx_b (user_b)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
    }

    // Видаляє прострочені тимчасові чати разом із повідомленнями між учасниками.
    function cleanupExpiredTempChats(PDO $pdo): void {
        // Беремо прострочені
        $stmt = $pdo->query("SELECT id, user_a, user_b FROM temp_chats WHERE expires_at <= NOW()");
        $expired = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($expired as $row) {
            $a = (int)$row['user_a'];
            $b = (int)$row['user_b'];
            // Видаляємо листування між цими двома
            try {
                $del = $pdo->prepare("DELETE FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)");
                $del->execute([$a, $b, $b, $a]);
            } catch (Exception $e) { /* таблиці messages може не бути полів — ігноруємо */ }
            $pdo->prepare("DELETE FROM temp_chats WHERE id = ?")->execute([(int)$row['id']]);
        }   // конец foreach
    }       // конец функции cleanupExpiredTempChats
}           // ← конец if (!function_exists(...))  ← её у вас и не хватало