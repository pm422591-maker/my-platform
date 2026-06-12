<?php
// groups_api.php v2 — ГРУПИ ТА КАНАЛИ В СТИЛІ TELEGRAM
// Дії: create | my_list | get_info | update_info | upload_avatar | get_members |
//      set_role | set_role_titles | invite | join_by_link | toggle_notifications |
//      get_messages | send_message | send_media | get_media | join | leave | delete
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');
session_start();

try {
    require_once __DIR__ . '/db_connect.php';

    // 🏗️ Базові таблиці
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

    // 🧬 МІГРАЦІЇ v2 (нові колонки; помилку "вже існує" — ігноруємо)
    $migrations = [
        "ALTER TABLE chat_groups ADD COLUMN description TEXT DEFAULT NULL",
        "ALTER TABLE chat_groups ADD COLUMN slug VARCHAR(50) DEFAULT NULL",
        "ALTER TABLE chat_groups ADD COLUMN privacy ENUM('public','private') NOT NULL DEFAULT 'private'",
        "ALTER TABLE chat_groups ADD COLUMN role_titles TEXT DEFAULT NULL",
        "ALTER TABLE chat_groups ADD UNIQUE INDEX idx_slug (slug)",
        "ALTER TABLE chat_group_members ADD COLUMN role ENUM('owner','moderator','member') NOT NULL DEFAULT 'member'",
        "ALTER TABLE chat_group_members ADD COLUMN notifications TINYINT(1) NOT NULL DEFAULT 1",
        "ALTER TABLE chat_group_messages ADD COLUMN media_type VARCHAR(12) NOT NULL DEFAULT 'text'",
        "ALTER TABLE chat_group_messages ADD COLUMN media_url VARCHAR(255) DEFAULT NULL",
    ];
    foreach ($migrations as $sql) {
        try { $pdo->exec($sql); } catch (Throwable $e) { /* колонка вже є */ }
    }

    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Not authorized']);
        exit;
    }
    $my_id = intval($_SESSION['user_id']);

    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) $data = [];
    $action = $data['action'] ?? $_POST['action'] ?? $_GET['action'] ?? '';

    // ===== ХЕЛПЕРИ =====
    function makeSlug($pdo) {
        for ($i = 0; $i < 10; $i++) {
            $slug = 'g' . substr(bin2hex(random_bytes(5)), 0, 8);
            $st = $pdo->prepare("SELECT id FROM chat_groups WHERE slug = :s");
            $st->execute([':s' => $slug]);
            if (!$st->fetch()) return $slug;
        }
        return 'g' . bin2hex(random_bytes(6));
    }

    function getGroup($pdo, $gid) {
        $st = $pdo->prepare("SELECT * FROM chat_groups WHERE id = :g");
        $st->execute([':g' => intval($gid)]);
        return $st->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    function myRole($pdo, $gid, $uid, $grp = null) {
        if ($grp && intval($grp['owner_id']) === $uid) return 'owner';
        $st = $pdo->prepare("SELECT role FROM chat_group_members WHERE group_id = :g AND user_id = :u");
        $st->execute([':g' => intval($gid), ':u' => $uid]);
        $r = $st->fetchColumn();
        if ($grp === null) {
            $g2 = getGroup($pdo, $gid);
            if ($g2 && intval($g2['owner_id']) === $uid) return 'owner';
        }
        return $r ?: null;
    }

    function addSystemMessage($pdo, $gid, $text) {
        $st = $pdo->prepare("INSERT INTO chat_group_messages (group_id, user_id, username, message, media_type)
                             VALUES (:g, 0, 'SYSTEM', :m, 'system')");
        $st->execute([':g' => intval($gid), ':m' => mb_substr($text, 0, 300)]);
    }

    function defaultTitles() {
        return ['owner' => 'Власник', 'moderator' => 'Модератор', 'member' => 'Учасник'];
    }

    function groupTitles($grp) {
        $t = defaultTitles();
        if (!empty($grp['role_titles'])) {
            $j = json_decode($grp['role_titles'], true);
            if (is_array($j)) foreach (['owner','moderator','member'] as $k)
                if (!empty($j[$k])) $t[$k] = mb_substr($j[$k], 0, 30);
        }
        return $t;
    }

    function userInfo($pdo, $uid) {
        try {
            $st = $pdo->prepare("SELECT username, avatar_url FROM users WHERE id = :u");
            $st->execute([':u' => intval($uid)]);
            return $st->fetch(PDO::FETCH_ASSOC) ?: ['username' => 'Користувач', 'avatar_url' => null];
        } catch (Throwable $e) { return ['username' => 'Користувач', 'avatar_url' => null]; }
    }

    // ===== СТВОРИТИ =====
    if ($action === 'create') {
        $name = trim(mb_substr($data['name'] ?? '', 0, 80));
        $type = ($data['type'] ?? 'group') === 'channel' ? 'channel' : 'group';
        if ($name === '') { echo json_encode(['success' => false, 'message' => 'Введіть назву']); exit; }

        $slug = makeSlug($pdo);
        $st = $pdo->prepare("INSERT INTO chat_groups (owner_id, name, type, slug, privacy) VALUES (:o, :n, :t, :s, 'private')");
        $st->execute([':o' => $my_id, ':n' => $name, ':t' => $type, ':s' => $slug]);
        $gid = intval($pdo->lastInsertId());

        $pdo->prepare("INSERT IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (:g, :u, 'owner')")
            ->execute([':g' => $gid, ':u' => $my_id]);

        echo json_encode(['success' => true, 'group' => [
            'id' => $gid, 'name' => $name, 'type' => $type, 'owner_id' => $my_id,
            'slug' => $slug, 'privacy' => 'private', 'members' => 1
        ]]);
        exit;
    }

    // ===== МОЇ ГРУПИ =====
    if ($action === 'my_list') {
        $stmt = $pdo->prepare("
            SELECT g.id, g.name, g.type, g.owner_id, g.avatar, g.slug, g.privacy, g.description,
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

    // ===== ІНФО ПРО ГРУПУ =====
    if ($action === 'get_info') {
        $gid = intval($data['group_id'] ?? $_GET['group_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
        if (!$grp) { echo json_encode(['success' => false, 'message' => 'Не знайдено']); exit; }

        $st = $pdo->prepare("SELECT COUNT(*) FROM chat_group_members WHERE group_id = :g");
        $st->execute([':g' => $gid]);
        $count = intval($st->fetchColumn());

        $st = $pdo->prepare("SELECT notifications FROM chat_group_members WHERE group_id = :g AND user_id = :u");
        $st->execute([':g' => $gid, ':u' => $my_id]);
        $notif = $st->fetchColumn();

        echo json_encode(['success' => true, 'group' => [
            'id' => intval($grp['id']),
            'name' => $grp['name'],
            'type' => $grp['type'],
            'owner_id' => intval($grp['owner_id']),
            'avatar' => $grp['avatar'],
            'description' => $grp['description'],
            'slug' => $grp['slug'],
            'privacy' => $grp['privacy'] ?: 'private',
            'role_titles' => groupTitles($grp),
            'members' => $count,
            'my_role' => myRole($pdo, $gid, $my_id, $grp),
            'my_notifications' => ($notif === false ? 1 : intval($notif))
        ]]);
        exit;
    }

    // ===== ОНОВИТИ НАЗВУ / ОПИС / ПОСИЛАННЯ / ПРИВАТНІСТЬ =====
    if ($action === 'update_info') {
        $gid = intval($data['group_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
        if (!$grp) { echo json_encode(['success' => false, 'message' => 'Не знайдено']); exit; }
        $role = myRole($pdo, $gid, $my_id, $grp);

        // Назву та опис можуть змінювати власник і модератор
        if (!in_array($role, ['owner', 'moderator'])) {
            echo json_encode(['success' => false, 'message' => 'Недостатньо прав']); exit;
        }

        $fields = []; $params = [':g' => $gid];

        if (isset($data['name'])) {
            $name = trim(mb_substr($data['name'], 0, 80));
            if ($name !== '') { $fields[] = "name = :n"; $params[':n'] = $name; }
        }
        if (array_key_exists('description', $data)) {
            $fields[] = "description = :d";
            $params[':d'] = trim(mb_substr($data['description'] ?? '', 0, 500));
        }

        // Посилання та приватність — лише власник
        if (isset($data['slug']) && $role === 'owner') {
            $slug = strtolower(preg_replace('/[^a-zA-Z0-9_]/', '', $data['slug']));
            $slug = mb_substr($slug, 0, 40);
            if (strlen($slug) < 4) { echo json_encode(['success' => false, 'message' => 'Посилання мінімум 4 символи (латиниця, цифри, _)']); exit; }
            $st = $pdo->prepare("SELECT id FROM chat_groups WHERE slug = :s AND id != :g");
            $st->execute([':s' => $slug, ':g' => $gid]);
            if ($st->fetch()) { echo json_encode(['success' => false, 'message' => 'Це посилання вже зайняте']); exit; }
            $fields[] = "slug = :s"; $params[':s'] = $slug;
        }
        if (isset($data['privacy']) && $role === 'owner') {
            $fields[] = "privacy = :p";
            $params[':p'] = $data['privacy'] === 'public' ? 'public' : 'private';
        }

        if ($fields) {
            $pdo->prepare("UPDATE chat_groups SET " . implode(', ', $fields) . " WHERE id = :g")->execute($params);
        }
        echo json_encode(['success' => true]);
        exit;
    }

    // ===== АВАТАР ГРУПИ (multipart) =====
    if ($action === 'upload_avatar') {
        $gid = intval($_POST['group_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
        if (!$grp) { echo json_encode(['success' => false, 'message' => 'Не знайдено']); exit; }
        if (!in_array(myRole($pdo, $gid, $my_id, $grp), ['owner', 'moderator'])) {
            echo json_encode(['success' => false, 'message' => 'Недостатньо прав']); exit;
        }
        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            echo json_encode(['success' => false, 'message' => 'Файл не отримано']); exit;
        }
        $ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg','jpeg','png','gif','webp'])) {
            echo json_encode(['success' => false, 'message' => 'Лише зображення']); exit;
        }
        $dir = __DIR__ . '/uploads/groups';
        if (!is_dir($dir)) mkdir($dir, 0775, true);
        $fname = 'gava_' . $gid . '_' . time() . '.' . $ext;
        if (!move_uploaded_file($_FILES['file']['tmp_name'], $dir . '/' . $fname)) {
            echo json_encode(['success' => false, 'message' => 'Не вдалося зберегти']); exit;
        }
        $url = 'uploads/groups/' . $fname;
        $pdo->prepare("UPDATE chat_groups SET avatar = :a WHERE id = :g")->execute([':a' => $url, ':g' => $gid]);
        echo json_encode(['success' => true, 'avatar' => $url]);
        exit;
    }

    // ===== УЧАСНИКИ =====
    if ($action === 'get_members') {
        $gid = intval($data['group_id'] ?? $_GET['group_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
        if (!$grp) { echo json_encode(['success' => false]); exit; }

        $st = $pdo->prepare("
            SELECT m.user_id, m.role, m.joined_at, u.username, u.avatar_url
            FROM chat_group_members m
            LEFT JOIN users u ON u.id = m.user_id
            WHERE m.group_id = :g
            ORDER BY FIELD(m.role, 'owner', 'moderator', 'member'), m.joined_at ASC
        ");
        $st->execute([':g' => $gid]);
        $members = $st->fetchAll(PDO::FETCH_ASSOC);
        foreach ($members as &$m) {
            if (intval($m['user_id']) === intval($grp['owner_id'])) $m['role'] = 'owner';
        }
        echo json_encode(['success' => true, 'members' => $members, 'role_titles' => groupTitles($grp)]);
        exit;
    }

    // ===== РОЛІ (лише власник) =====
    if ($action === 'set_role') {
        $gid = intval($data['group_id'] ?? 0);
        $uid = intval($data['user_id'] ?? 0);
        $role = in_array($data['role'] ?? '', ['moderator', 'member']) ? $data['role'] : 'member';
        $grp = getGroup($pdo, $gid);
        if (!$grp || myRole($pdo, $gid, $my_id, $grp) !== 'owner') {
            echo json_encode(['success' => false, 'message' => 'Лише власник змінює ролі']); exit;
        }
        if ($uid === intval($grp['owner_id'])) { echo json_encode(['success' => false, 'message' => 'Власника не можна змінити']); exit; }
        $pdo->prepare("UPDATE chat_group_members SET role = :r WHERE group_id = :g AND user_id = :u")
            ->execute([':r' => $role, ':g' => $gid, ':u' => $uid]);
        echo json_encode(['success' => true]);
        exit;
    }

    if ($action === 'set_role_titles') {
        $gid = intval($data['group_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
        if (!$grp || myRole($pdo, $gid, $my_id, $grp) !== 'owner') {
            echo json_encode(['success' => false, 'message' => 'Лише власник']); exit;
        }
        $t = defaultTitles();
        $in = $data['titles'] ?? [];
        foreach (['owner','moderator','member'] as $k) {
            if (!empty($in[$k])) $t[$k] = trim(mb_substr($in[$k], 0, 30));
        }
        $pdo->prepare("UPDATE chat_groups SET role_titles = :t WHERE id = :g")
            ->execute([':t' => json_encode($t, JSON_UNESCAPED_UNICODE), ':g' => $gid]);
        echo json_encode(['success' => true, 'role_titles' => $t]);
        exit;
    }

    // ===== ЗАПРОСИТИ ДРУГА =====
    if ($action === 'invite') {
        $gid = intval($data['group_id'] ?? 0);
        $uid = intval($data['user_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
        if (!$grp) { echo json_encode(['success' => false]); exit; }
        if (!myRole($pdo, $gid, $my_id, $grp)) {
            echo json_encode(['success' => false, 'message' => 'Ви не учасник']); exit;
        }
        // Чи вже учасник?
        $st = $pdo->prepare("SELECT 1 FROM chat_group_members WHERE group_id = :g AND user_id = :u");
        $st->execute([':g' => $gid, ':u' => $uid]);
        if ($st->fetch()) { echo json_encode(['success' => false, 'message' => 'Уже в групі']); exit; }

        $pdo->prepare("INSERT INTO chat_group_members (group_id, user_id, role) VALUES (:g, :u, 'member')")
            ->execute([':g' => $gid, ':u' => $uid]);

        $me = userInfo($pdo, $my_id);
        $them = userInfo($pdo, $uid);
        addSystemMessage($pdo, $gid, "➕ {$me['username']} запросив(ла) {$them['username']} до " . ($grp['type'] === 'channel' ? 'каналу' : 'групи'));
        echo json_encode(['success' => true]);
        exit;
    }

    // ===== ВСТУП ЗА ПОСИЛАННЯМ =====
    if ($action === 'join_by_link') {
        $slug = trim($data['slug'] ?? $_GET['slug'] ?? '');
        if ($slug === '') { echo json_encode(['success' => false]); exit; }
        $st = $pdo->prepare("SELECT * FROM chat_groups WHERE slug = :s");
        $st->execute([':s' => $slug]);
        $grp = $st->fetch(PDO::FETCH_ASSOC);
        if (!$grp) { echo json_encode(['success' => false, 'message' => 'Посилання недійсне']); exit; }
        $gid = intval($grp['id']);

        $st = $pdo->prepare("SELECT 1 FROM chat_group_members WHERE group_id = :g AND user_id = :u");
        $st->execute([':g' => $gid, ':u' => $my_id]);
        $already = (bool)$st->fetch();

        if (!$already) {
            $pdo->prepare("INSERT INTO chat_group_members (group_id, user_id, role) VALUES (:g, :u, 'member')")
                ->execute([':g' => $gid, ':u' => $my_id]);
            $me = userInfo($pdo, $my_id);
            addSystemMessage($pdo, $gid, "🔗 {$me['username']} приєднався(лась) за посиланням");
        }
        echo json_encode(['success' => true, 'already' => $already, 'group' => [
            'id' => $gid, 'name' => $grp['name'], 'type' => $grp['type'], 'owner_id' => intval($grp['owner_id'])
        ]]);
        exit;
    }

    // ===== СПОВІЩЕННЯ ON/OFF =====
    if ($action === 'toggle_notifications') {
        $gid = intval($data['group_id'] ?? 0);
        $on = !empty($data['enabled']) ? 1 : 0;
        $pdo->prepare("UPDATE chat_group_members SET notifications = :n WHERE group_id = :g AND user_id = :u")
            ->execute([':n' => $on, ':g' => $gid, ':u' => $my_id]);
        echo json_encode(['success' => true, 'enabled' => $on]);
        exit;
    }

    // ===== ПОВІДОМЛЕННЯ =====
    if ($action === 'get_messages') {
        $gid = intval($data['group_id'] ?? $_GET['group_id'] ?? 0);
        $since = intval($data['since_id'] ?? $_GET['since_id'] ?? 0);
        if ($gid <= 0) { echo json_encode(['success' => false]); exit; }

        $stmt = $pdo->prepare("
            SELECT gm.id, gm.user_id, gm.username, gm.avatar, gm.message, gm.media_type, gm.media_url, gm.created_at
            FROM chat_group_messages gm
            WHERE gm.group_id = :g AND gm.id > :s
            ORDER BY gm.id ASC LIMIT 100
        ");
        $stmt->execute([':g' => $gid, ':s' => $since]);
        echo json_encode(['success' => true, 'messages' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        exit;
    }

    if ($action === 'send_message') {
        $gid = intval($data['group_id'] ?? 0);
        $text = trim(mb_substr($data['text'] ?? '', 0, 2000));
        if ($gid <= 0 || $text === '') { echo json_encode(['success' => false]); exit; }

        $grp = getGroup($pdo, $gid);
        if (!$grp) { echo json_encode(['success' => false, 'message' => 'Не знайдено']); exit; }
        $role = myRole($pdo, $gid, $my_id, $grp);
        if (!$role) { echo json_encode(['success' => false, 'message' => 'Ви не учасник']); exit; }
        if ($grp['type'] === 'channel' && !in_array($role, ['owner', 'moderator'])) {
            echo json_encode(['success' => false, 'message' => 'У каналі публікують лише адміністратори']); exit;
        }

        $uname = $data['username'] ?? ($_SESSION['username'] ?? 'Користувач');
        $uavatar = $data['avatar'] ?? null;
        $stmt = $pdo->prepare("INSERT INTO chat_group_messages (group_id, user_id, username, avatar, message, media_type)
                               VALUES (:g, :u, :n, :a, :m, 'text')");
        $stmt->execute([':g' => $gid, ':u' => $my_id, ':n' => mb_substr($uname, 0, 80), ':a' => $uavatar, ':m' => $text]);
        echo json_encode(['success' => true, 'id' => intval($pdo->lastInsertId())]);
        exit;
    }

    // ===== МЕДІА: ФОТО ТА ГОЛОСОВІ (multipart) =====
    if ($action === 'send_media') {
        $gid = intval($_POST['group_id'] ?? 0);
        $type = ($_POST['type'] ?? '') === 'voice' ? 'voice' : 'image';
        $grp = getGroup($pdo, $gid);
        if (!$grp) { echo json_encode(['success' => false]); exit; }
        $role = myRole($pdo, $gid, $my_id, $grp);
        if (!$role) { echo json_encode(['success' => false, 'message' => 'Ви не учасник']); exit; }
        if ($grp['type'] === 'channel' && !in_array($role, ['owner', 'moderator'])) {
            echo json_encode(['success' => false, 'message' => 'У каналі публікують лише адміністратори']); exit;
        }
        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            echo json_encode(['success' => false, 'message' => 'Файл не отримано']); exit;
        }
        if ($_FILES['file']['size'] > 15 * 1024 * 1024) {
            echo json_encode(['success' => false, 'message' => 'Файл завеликий (макс 15МБ)']); exit;
        }

        $ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
        if ($type === 'image' && !in_array($ext, ['jpg','jpeg','png','gif','webp'])) {
            echo json_encode(['success' => false, 'message' => 'Лише зображення']); exit;
        }
        if ($type === 'voice') {
            if (!in_array($ext, ['webm','ogg','mp3','m4a','wav'])) $ext = 'webm';
        }

        $dir = __DIR__ . '/uploads/groups';
        if (!is_dir($dir)) mkdir($dir, 0775, true);
        $fname = $type . '_' . $gid . '_' . $my_id . '_' . time() . '_' . substr(bin2hex(random_bytes(3)), 0, 5) . '.' . $ext;
        if (!move_uploaded_file($_FILES['file']['tmp_name'], $dir . '/' . $fname)) {
            echo json_encode(['success' => false, 'message' => 'Не вдалося зберегти']); exit;
        }
        $url = 'uploads/groups/' . $fname;

        $uname = $_POST['username'] ?? ($_SESSION['username'] ?? 'Користувач');
        $uavatar = $_POST['avatar'] ?? null;
        $stmt = $pdo->prepare("INSERT INTO chat_group_messages (group_id, user_id, username, avatar, message, media_type, media_url)
                               VALUES (:g, :u, :n, :a, '', :t, :url)");
        $stmt->execute([':g' => $gid, ':u' => $my_id, ':n' => mb_substr($uname, 0, 80), ':a' => $uavatar, ':t' => $type, ':url' => $url]);
        echo json_encode(['success' => true, 'id' => intval($pdo->lastInsertId()), 'url' => $url]);
        exit;
    }

    // ===== РОЗДІЛИ МЕДІА / ГОЛОСОВІ =====
    if ($action === 'get_media') {
        $gid = intval($data['group_id'] ?? $_GET['group_id'] ?? 0);
        $kind = ($data['kind'] ?? $_GET['kind'] ?? 'image') === 'voice' ? 'voice' : 'image';
        $st = $pdo->prepare("SELECT id, username, media_url, created_at FROM chat_group_messages
                             WHERE group_id = :g AND media_type = :t AND media_url IS NOT NULL
                             ORDER BY id DESC LIMIT 60");
        $st->execute([':g' => $gid, ':t' => $kind]);
        echo json_encode(['success' => true, 'items' => $st->fetchAll(PDO::FETCH_ASSOC)]);
        exit;
    }

    // ===== JOIN / LEAVE / DELETE =====
    if ($action === 'join') {
        $gid = intval($data['group_id'] ?? 0);
        if ($gid > 0) {
            $pdo->prepare("INSERT IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (:g, :u, 'member')")
                ->execute([':g' => $gid, ':u' => $my_id]);
        }
        echo json_encode(['success' => true]);
        exit;
    }

    if ($action === 'leave') {
        $gid = intval($data['group_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
        if ($grp && intval($grp['owner_id']) === $my_id) {
            echo json_encode(['success' => false, 'message' => 'Власник не може вийти. Видаліть групу або передайте права.']); exit;
        }
        if ($gid > 0) {
            $pdo->prepare("DELETE FROM chat_group_members WHERE group_id = :g AND user_id = :u")
                ->execute([':g' => $gid, ':u' => $my_id]);
            $me = userInfo($pdo, $my_id);
            addSystemMessage($pdo, $gid, "🚪 {$me['username']} вийшов(ла) з " . ($grp && $grp['type'] === 'channel' ? 'каналу' : 'групи'));
        }
        echo json_encode(['success' => true]);
        exit;
    }

    if ($action === 'delete') {
        $gid = intval($data['group_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
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
