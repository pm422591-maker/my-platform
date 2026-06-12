<?php
// groups_api.php — ГРУПИ ТА КАНАЛИ (створення, список, повідомлення, учасники)
// Дії: create | my_list | get_messages | send_message | join | leave | delete
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');
session_start();

try {
    require_once __DIR__ . '/db_connect.php';

    // 🏗️ Авто-створення таблиць (виконається 1 раз, далі — миттєво)
    $pdo->exec("CREATE TABLE IF NOT EXISTS chat_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_id INT NOT NULL,
        name VARCHAR(80) NOT NULL,
        type ENUM('group','channel') NOT NULL DEFAULT 'group',
        avatar VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_owner (owner_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS chat_group_members (
        group_id INT NOT NULL,
        user_id INT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id),
        INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS chat_group_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        user_id INT NOT NULL,
        username VARCHAR(80) DEFAULT 'Користувач',
        avatar VARCHAR(255) DEFAULT NULL,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_group (group_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Not authorized']);
        exit;
    }
    $my_id = intval($_SESSION['user_id']);

    $data = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? $_GET['action'] ?? '';

    // ➕ СТВОРИТИ ГРУПУ / КАНАЛ
    if ($action === 'create') {
        $name = trim(mb_substr($data['name'] ?? '', 0, 80));
        $type = ($data['type'] ?? 'group') === 'channel' ? 'channel' : 'group';

        if ($name === '') {
            echo json_encode(['success' => false, 'message' => 'Введіть назву']);
            exit;
        }

        $stmt = $pdo->prepare("INSERT INTO chat_groups (owner_id, name, type) VALUES (:o, :n, :t)");
        $stmt->execute([':o' => $my_id, ':n' => $name, ':t' => $type]);
        $gid = intval($pdo->lastInsertId());

        // Власник автоматично стає учасником
        $pdo->prepare("INSERT IGNORE INTO chat_group_members (group_id, user_id) VALUES (:g, :u)")
            ->execute([':g' => $gid, ':u' => $my_id]);

        echo json_encode(['success' => true, 'group' => [
            'id' => $gid, 'name' => $name, 'type' => $type, 'owner_id' => $my_id, 'members' => 1
        ]]);
        exit;
    }

    // 📋 МОЇ ГРУПИ ТА КАНАЛИ (де я учасник або власник)
    if ($action === 'my_list') {
        $stmt = $pdo->prepare("
            SELECT g.id, g.name, g.type, g.owner_id, g.avatar,
                   (SELECT COUNT(*) FROM chat_group_members m WHERE m.group_id = g.id) AS members,
                   (SELECT message FROM chat_group_messages gm WHERE gm.group_id = g.id ORDER BY gm.id DESC LIMIT 1) AS last_message
            FROM chat_groups g
            WHERE g.owner_id = :uid1
               OR g.id IN (SELECT group_id FROM chat_group_members WHERE user_id = :uid2)
            ORDER BY g.created_at DESC
        ");
        $stmt->execute([':uid1' => $my_id, ':uid2' => $my_id]);
        echo json_encode(['success' => true, 'groups' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        exit;
    }

    // 💬 ПОВІДОМЛЕННЯ ГРУПИ (інкрементально: since_id)
    if ($action === 'get_messages') {
        $gid = intval($data['group_id'] ?? $_GET['group_id'] ?? 0);
        $since = intval($data['since_id'] ?? $_GET['since_id'] ?? 0);
        if ($gid <= 0) { echo json_encode(['success' => false]); exit; }

        $stmt = $pdo->prepare("
            SELECT gm.id, gm.user_id, gm.username, gm.avatar, gm.message, gm.created_at,
                   g.owner_id, g.type
            FROM chat_group_messages gm
            JOIN chat_groups g ON g.id = gm.group_id
            WHERE gm.group_id = :g AND gm.id > :s
            ORDER BY gm.id ASC LIMIT 100
        ");
        $stmt->execute([':g' => $gid, ':s' => $since]);
        echo json_encode(['success' => true, 'messages' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        exit;
    }

    // ✉️ ВІДПРАВИТИ ПОВІДОМЛЕННЯ
    if ($action === 'send_message') {
        $gid = intval($data['group_id'] ?? 0);
        $text = trim(mb_substr($data['text'] ?? '', 0, 2000));
        if ($gid <= 0 || $text === '') { echo json_encode(['success' => false]); exit; }

        // Перевірка прав: у каналі писати може лише власник
        $stmt = $pdo->prepare("SELECT owner_id, type FROM chat_groups WHERE id = :g");
        $stmt->execute([':g' => $gid]);
        $grp = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$grp) { echo json_encode(['success' => false, 'message' => 'Групу не знайдено']); exit; }
        if ($grp['type'] === 'channel' && intval($grp['owner_id']) !== $my_id) {
            echo json_encode(['success' => false, 'message' => 'У каналі публікує лише власник']);
            exit;
        }

        $uname = $data['username'] ?? ($_SESSION['username'] ?? 'Користувач');
        $uavatar = $data['avatar'] ?? null;

        $stmt = $pdo->prepare("INSERT INTO chat_group_messages (group_id, user_id, username, avatar, message)
                               VALUES (:g, :u, :n, :a, :m)");
        $stmt->execute([':g' => $gid, ':u' => $my_id, ':n' => mb_substr($uname, 0, 80), ':a' => $uavatar, ':m' => $text]);

        echo json_encode(['success' => true, 'id' => intval($pdo->lastInsertId())]);
        exit;
    }

    // 🚪 ПРИЄДНАТИСЯ / ВИЙТИ
    if ($action === 'join') {
        $gid = intval($data['group_id'] ?? 0);
        if ($gid > 0) {
            $pdo->prepare("INSERT IGNORE INTO chat_group_members (group_id, user_id) VALUES (:g, :u)")
                ->execute([':g' => $gid, ':u' => $my_id]);
        }
        echo json_encode(['success' => true]);
        exit;
    }

    if ($action === 'leave') {
        $gid = intval($data['group_id'] ?? 0);
        if ($gid > 0) {
            $pdo->prepare("DELETE FROM chat_group_members WHERE group_id = :g AND user_id = :u")
                ->execute([':g' => $gid, ':u' => $my_id]);
        }
        echo json_encode(['success' => true]);
        exit;
    }

    // 🗑️ ВИДАЛИТИ (лише власник)
    if ($action === 'delete') {
        $gid = intval($data['group_id'] ?? 0);
        $stmt = $pdo->prepare("SELECT owner_id FROM chat_groups WHERE id = :g");
        $stmt->execute([':g' => $gid]);
        $grp = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($grp && intval($grp['owner_id']) === $my_id) {
            $pdo->prepare("DELETE FROM chat_groups WHERE id = :g")->execute([':g' => $gid]);
            $pdo->prepare("DELETE FROM chat_group_members WHERE group_id = :g")->execute([':g' => $gid]);
            $pdo->prepare("DELETE FROM chat_group_messages WHERE group_id = :g")->execute([':g' => $gid]);
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Лише власник може видалити']);
        }
        exit;
    }

    echo json_encode(['success' => false, 'message' => 'Unknown action']);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>
