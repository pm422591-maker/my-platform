<?php
// groups_api.php v3 — ГРУПИ ТА КАНАЛИ В СТИЛІ TELEGRAM
// Нове у v3: роль "співвласник", підписники каналів, прив'язана група обговорення,
// слаг з назви, реакції на повідомлення, стікери
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

    // 📨 Заявки на вступ у приватні групи/канали
    $pdo->exec("CREATE TABLE IF NOT EXISTS chat_group_requests (
        group_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id),
        INDEX idx_grp (group_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // ❤️ Реакції
    $pdo->exec("CREATE TABLE IF NOT EXISTS chat_group_reactions (
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        emoji VARCHAR(32) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (message_id, user_id, emoji),
        INDEX idx_msg (message_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // 🧬 МІГРАЦІЇ (помилку "вже існує" ігноруємо)
    $migrations = [
        "ALTER TABLE chat_groups ADD COLUMN description TEXT DEFAULT NULL",
        "ALTER TABLE chat_groups ADD COLUMN slug VARCHAR(50) DEFAULT NULL",
        "ALTER TABLE chat_groups ADD COLUMN privacy ENUM('public','private') NOT NULL DEFAULT 'private'",
        "ALTER TABLE chat_groups ADD COLUMN role_titles TEXT DEFAULT NULL",
        "ALTER TABLE chat_groups ADD COLUMN linked_group_id INT DEFAULT NULL",
        "ALTER TABLE chat_groups ADD UNIQUE INDEX idx_slug (slug)",
        "ALTER TABLE chat_group_members ADD COLUMN role ENUM('owner','moderator','member') NOT NULL DEFAULT 'member'",
        "ALTER TABLE chat_group_members MODIFY COLUMN role ENUM('owner','coowner','moderator','member') NOT NULL DEFAULT 'member'",
        "ALTER TABLE chat_group_members ADD COLUMN notifications TINYINT(1) NOT NULL DEFAULT 1",
        "ALTER TABLE chat_group_messages ADD COLUMN media_type VARCHAR(12) NOT NULL DEFAULT 'text'",
        "ALTER TABLE chat_group_messages ADD COLUMN media_url VARCHAR(255) DEFAULT NULL",
        "ALTER TABLE chat_group_messages ADD COLUMN edited TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE chat_group_messages ADD COLUMN fwd_from VARCHAR(80) DEFAULT NULL",
    ];
    foreach ($migrations as $sql) {
        try { $pdo->exec($sql); } catch (Throwable $e) { /* вже застосовано */ }
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

    // 🔗 СЛАГ З НАЗВИ: транслітерація + випадковий хвіст
    function slugFromName($pdo, $name) {
        $map = [
            'а'=>'a','б'=>'b','в'=>'v','г'=>'h','ґ'=>'g','д'=>'d','е'=>'e','є'=>'ye','ж'=>'zh',
            'з'=>'z','и'=>'y','і'=>'i','ї'=>'yi','й'=>'y','к'=>'k','л'=>'l','м'=>'m','н'=>'n',
            'о'=>'o','п'=>'p','р'=>'r','с'=>'s','т'=>'t','у'=>'u','ф'=>'f','х'=>'kh','ц'=>'ts',
            'ч'=>'ch','ш'=>'sh','щ'=>'shch','ь'=>'','ю'=>'yu','я'=>'ya','ы'=>'y','э'=>'e','ё'=>'yo','ъ'=>''
        ];
        $base = mb_strtolower(trim($name));
        $base = strtr($base, $map);
        $base = preg_replace('/[^a-z0-9_]+/', '_', $base);
        $base = trim(preg_replace('/_+/', '_', $base), '_');
        $base = substr($base, 0, 24);
        if (strlen($base) < 3) $base = 'chat';

        for ($i = 0; $i < 12; $i++) {
            $tail = substr(bin2hex(random_bytes(3)), 0, 4);
            $slug = $base . '_' . $tail;
            $st = $pdo->prepare("SELECT id FROM chat_groups WHERE slug = :s");
            $st->execute([':s' => $slug]);
            if (!$st->fetch()) return $slug;
        }
        return $base . '_' . bin2hex(random_bytes(4));
    }

    function getGroup($pdo, $gid) {
        $st = $pdo->prepare("SELECT * FROM chat_groups WHERE id = :g");
        $st->execute([':g' => intval($gid)]);
        return $st->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    function myRole($pdo, $gid, $uid, $grp = null) {
        if ($grp === null) $grp = getGroup($pdo, $gid);
        if ($grp && intval($grp['owner_id']) === $uid) return 'owner';
        $st = $pdo->prepare("SELECT role FROM chat_group_members WHERE group_id = :g AND user_id = :u");
        $st->execute([':g' => intval($gid), ':u' => $uid]);
        $r = $st->fetchColumn();
        return $r ?: null;
    }

    // Адміни: пишуть у канал, міняють назву/опис/аватар, запрошують
    function isAdminRole($role) { return in_array($role, ['owner', 'coowner', 'moderator']); }

    function addSystemMessage($pdo, $gid, $text) {
        $st = $pdo->prepare("INSERT INTO chat_group_messages (group_id, user_id, username, message, media_type)
                             VALUES (:g, 0, 'SYSTEM', :m, 'system')");
        $st->execute([':g' => intval($gid), ':m' => mb_substr($text, 0, 300)]);
    }

    function defaultTitles($type = 'group') {
        return [
            'owner' => 'Власник',
            'coowner' => 'Співвласник',
            'moderator' => 'Модератор',
            'member' => $type === 'channel' ? 'Підписник' : 'Учасник'
        ];
    }

    function groupTitles($grp) {
        $t = defaultTitles($grp['type'] ?? 'group');
        if (!empty($grp['role_titles'])) {
            $j = json_decode($grp['role_titles'], true);
            if (is_array($j)) foreach (['owner','coowner','moderator','member'] as $k)
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

        $slug = slugFromName($pdo, $name); // ✨ слаг з назви
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
            SELECT g.id, g.name, g.type, g.owner_id, g.avatar, g.slug, g.privacy, g.description, g.linked_group_id,
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

    // ===== ІНФО =====
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

        // 💬 Прив'язана група обговорення (для каналів)
        $linked = null;
        if (!empty($grp['linked_group_id'])) {
            $lg = getGroup($pdo, intval($grp['linked_group_id']));
            if ($lg && $lg['type'] === 'group') {
                $linked = ['id' => intval($lg['id']), 'name' => $lg['name'], 'owner_id' => intval($lg['owner_id'])];
            }
        }

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
            'my_notifications' => ($notif === false ? 1 : intval($notif)),
            'linked_group' => $linked
        ]]);
        exit;
    }

    // ===== ОНОВЛЕННЯ ІНФО =====
    if ($action === 'update_info') {
        $gid = intval($data['group_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
        if (!$grp) { echo json_encode(['success' => false, 'message' => 'Не знайдено']); exit; }
        $role = myRole($pdo, $gid, $my_id, $grp);

        if (!isAdminRole($role)) { echo json_encode(['success' => false, 'message' => 'Недостатньо прав']); exit; }

        $fields = []; $params = [':g' => $gid];

        if (isset($data['name'])) {
            $name = trim(mb_substr($data['name'], 0, 80));
            if ($name !== '') { $fields[] = "name = :n"; $params[':n'] = $name; }
        }
        if (array_key_exists('description', $data)) {
            $fields[] = "description = :d";
            $params[':d'] = trim(mb_substr($data['description'] ?? '', 0, 500));
        }

        // Посилання та приватність — лише власник; слаг змінюється ЛИШЕ якщо вільний
        if (isset($data['slug']) && $role === 'owner') {
            $slug = strtolower(preg_replace('/[^a-zA-Z0-9_]/', '', $data['slug']));
            $slug = substr($slug, 0, 40);
            if (strlen($slug) < 4) { echo json_encode(['success' => false, 'message' => 'Посилання мінімум 4 символи (латиниця, цифри, _)']); exit; }
            $st = $pdo->prepare("SELECT id FROM chat_groups WHERE slug = :s AND id != :g");
            $st->execute([':s' => $slug, ':g' => $gid]);
            if ($st->fetch()) { echo json_encode(['success' => false, 'message' => '❌ Це посилання вже зайняте, оберіть інше']); exit; }
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

    // ===== 💬 ГРУПА ОБГОВОРЕННЯ КАНАЛУ (лише власник) =====
    if ($action === 'set_linked_group') {
        $gid = intval($data['group_id'] ?? 0);          // канал
        $lid = intval($data['linked_group_id'] ?? 0);   // група (0 = відв'язати)
        $grp = getGroup($pdo, $gid);
        if (!$grp || $grp['type'] !== 'channel') { echo json_encode(['success' => false, 'message' => 'Це не канал']); exit; }
        if (myRole($pdo, $gid, $my_id, $grp) !== 'owner') { echo json_encode(['success' => false, 'message' => 'Лише власник каналу']); exit; }

        if ($lid > 0) {
            $lg = getGroup($pdo, $lid);
            if (!$lg || $lg['type'] !== 'group') { echo json_encode(['success' => false, 'message' => 'Оберіть саме групу']); exit; }
            if (!isAdminRole(myRole($pdo, $lid, $my_id, $lg))) { echo json_encode(['success' => false, 'message' => 'Ви маєте бути адміном цієї групи']); exit; }
            $pdo->prepare("UPDATE chat_groups SET linked_group_id = :l WHERE id = :g")->execute([':l' => $lid, ':g' => $gid]);
            addSystemMessage($pdo, $gid, "💬 До каналу прив'язано групу обговорення «{$lg['name']}»");
        } else {
            $pdo->prepare("UPDATE chat_groups SET linked_group_id = NULL WHERE id = :g")->execute([':g' => $gid]);
        }
        echo json_encode(['success' => true]);
        exit;
    }

    // ===== АВАТАР =====
    if ($action === 'upload_avatar') {
        $gid = intval($_POST['group_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
        if (!$grp) { echo json_encode(['success' => false, 'message' => 'Не знайдено']); exit; }
        if (!isAdminRole(myRole($pdo, $gid, $my_id, $grp))) {
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
            ORDER BY FIELD(m.role, 'owner', 'coowner', 'moderator', 'member'), m.joined_at ASC
        ");
        $st->execute([':g' => $gid]);
        $members = $st->fetchAll(PDO::FETCH_ASSOC);
        foreach ($members as &$m) {
            if (intval($m['user_id']) === intval($grp['owner_id'])) $m['role'] = 'owner';
        }
        echo json_encode(['success' => true, 'members' => $members, 'role_titles' => groupTitles($grp), 'type' => $grp['type']]);
        exit;
    }

    // ===== РОЛІ: призначає ЛИШЕ ВЛАСНИК (автор) =====
    if ($action === 'set_role') {
        $gid = intval($data['group_id'] ?? 0);
        $uid = intval($data['user_id'] ?? 0);
        $role = in_array($data['role'] ?? '', ['coowner', 'moderator', 'member']) ? $data['role'] : 'member';
        $grp = getGroup($pdo, $gid);
        if (!$grp || myRole($pdo, $gid, $my_id, $grp) !== 'owner') {
            echo json_encode(['success' => false, 'message' => 'Лише власник призначає ролі']); exit;
        }
        if ($uid === intval($grp['owner_id'])) { echo json_encode(['success' => false, 'message' => 'Власника не можна змінити']); exit; }
        $pdo->prepare("UPDATE chat_group_members SET role = :r WHERE group_id = :g AND user_id = :u")
            ->execute([':r' => $role, ':g' => $gid, ':u' => $uid]);

        $titles = groupTitles($grp);
        $them = userInfo($pdo, $uid);
        addSystemMessage($pdo, $gid, "⭐ {$them['username']} тепер «{$titles[$role]}»");
        echo json_encode(['success' => true]);
        exit;
    }

    // Перейменування ОДНІЄЇ ролі (лише власник)
    if ($action === 'set_role_titles') {
        $gid = intval($data['group_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
        if (!$grp || myRole($pdo, $gid, $my_id, $grp) !== 'owner') {
            echo json_encode(['success' => false, 'message' => 'Лише власник']); exit;
        }
        $t = groupTitles($grp); // поточні (включно з кастомними)
        $in = $data['titles'] ?? [];
        foreach (['owner','coowner','moderator','member'] as $k) {
            if (!empty($in[$k])) $t[$k] = trim(mb_substr($in[$k], 0, 30));
        }
        $pdo->prepare("UPDATE chat_groups SET role_titles = :t WHERE id = :g")
            ->execute([':t' => json_encode($t, JSON_UNESCAPED_UNICODE), ':g' => $gid]);
        echo json_encode(['success' => true, 'role_titles' => $t]);
        exit;
    }

    // ===== ЗАПРОСИТИ =====
    if ($action === 'invite') {
        $gid = intval($data['group_id'] ?? 0);
        $uid = intval($data['user_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
        if (!$grp) { echo json_encode(['success' => false]); exit; }
        $role = myRole($pdo, $gid, $my_id, $grp);
        if (!$role) { echo json_encode(['success' => false, 'message' => 'Ви не учасник']); exit; }
        // У канал запрошують лише адміни; у групу — будь-який учасник
        if ($grp['type'] === 'channel' && !isAdminRole($role)) {
            echo json_encode(['success' => false, 'message' => 'У канал запрошують лише адміністратори']); exit;
        }
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

    // 🏆 ТОП-3 ГРУПИ ТА ТОП-3 КАНАЛИ за кількістю учасників (для сторінки пошуку)
    if ($action === 'top_discover') {
        $out = [];
        foreach (['group', 'channel'] as $t) {
            $st = $pdo->prepare("
                SELECT g.id, g.name, g.type, g.avatar, g.slug, g.privacy, g.description,
                       (SELECT COUNT(*) FROM chat_group_members m WHERE m.group_id = g.id) AS members
                FROM chat_groups g
                WHERE g.type = :t
                ORDER BY members DESC, g.created_at DESC
                LIMIT 3
            ");
            $st->execute([':t' => $t]);
            $out[$t === 'group' ? 'groups' : 'channels'] = $st->fetchAll(PDO::FETCH_ASSOC);
        }
        echo json_encode(['success' => true] + $out);
        exit;
    }

    // ℹ️ ПУБЛІЧНА ІНФА для прев'ю (моє членство + статус заявки)
    if ($action === 'public_info') {
        $gid = intval($data['group_id'] ?? 0);
        $slug = trim($data['slug'] ?? '');
        if ($gid > 0) $grp = getGroup($pdo, $gid);
        else {
            $st = $pdo->prepare("SELECT * FROM chat_groups WHERE slug = :s");
            $st->execute([':s' => $slug]);
            $grp = $st->fetch(PDO::FETCH_ASSOC);
        }
        if (!$grp) { echo json_encode(['success' => false, 'message' => 'Не знайдено']); exit; }
        $gid = intval($grp['id']);

        $st = $pdo->prepare("SELECT COUNT(*) FROM chat_group_members WHERE group_id = :g");
        $st->execute([':g' => $gid]);
        $cnt = intval($st->fetchColumn());

        $st = $pdo->prepare("SELECT 1 FROM chat_group_requests WHERE group_id = :g AND user_id = :u");
        $st->execute([':g' => $gid, ':u' => $my_id]);

        echo json_encode(['success' => true, 'group' => [
            'id' => $gid, 'name' => $grp['name'], 'type' => $grp['type'],
            'owner_id' => intval($grp['owner_id']),
            'avatar' => $grp['avatar'], 'description' => $grp['description'],
            'slug' => $grp['slug'], 'privacy' => $grp['privacy'] ?: 'private',
            'members' => $cnt,
            'am_member' => (bool)myRole($pdo, $gid, $my_id, $grp),
            'has_request' => (bool)$st->fetch()
        ]]);
        exit;
    }

    // 📨 ЗАЯВКА НА ВСТУП (публічні — вступ одразу; приватні — заявка власнику)
    if ($action === 'request_join') {
        $gid = intval($data['group_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
        if (!$grp) { echo json_encode(['success' => false, 'message' => 'Не знайдено']); exit; }
        if (myRole($pdo, $gid, $my_id, $grp)) { echo json_encode(['success' => true, 'state' => 'member']); exit; }

        if (($grp['privacy'] ?: 'private') === 'public') {
            $pdo->prepare("INSERT IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (:g, :u, 'member')")
                ->execute([':g' => $gid, ':u' => $my_id]);
            $me = userInfo($pdo, $my_id);
            if ($grp['type'] === 'channel') addSystemMessage($pdo, $gid, "🔔 {$me['username']} підписався(лась) на канал");
            else addSystemMessage($pdo, $gid, "👋 {$me['username']} приєднався(лась)");
            echo json_encode(['success' => true, 'state' => 'joined', 'group' => [
                'id' => $gid, 'name' => $grp['name'], 'type' => $grp['type'], 'owner_id' => intval($grp['owner_id'])
            ]]);
        } else {
            $pdo->prepare("INSERT IGNORE INTO chat_group_requests (group_id, user_id) VALUES (:g, :u)")
                ->execute([':g' => $gid, ':u' => $my_id]);
            echo json_encode(['success' => true, 'state' => 'requested']);
        }
        exit;
    }

    // 📋 СПИСОК ЗАЯВОК (адміни)
    if ($action === 'list_requests') {
        $gid = intval($data['group_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
        if (!$grp || !isAdminRole(myRole($pdo, $gid, $my_id, $grp))) {
            echo json_encode(['success' => false, 'message' => 'Недостатньо прав']); exit;
        }
        $st = $pdo->prepare("
            SELECT r.user_id, r.created_at, u.username, u.avatar_url
            FROM chat_group_requests r
            LEFT JOIN users u ON u.id = r.user_id
            WHERE r.group_id = :g
            ORDER BY r.created_at ASC LIMIT 50
        ");
        $st->execute([':g' => $gid]);
        echo json_encode(['success' => true, 'requests' => $st->fetchAll(PDO::FETCH_ASSOC)]);
        exit;
    }

    // ✅/❌ РОЗГЛЯД ЗАЯВКИ (адміни)
    if ($action === 'resolve_request') {
        $gid = intval($data['group_id'] ?? 0);
        $uid = intval($data['user_id'] ?? 0);
        $accept = !empty($data['accept']);
        $grp = getGroup($pdo, $gid);
        if (!$grp || !isAdminRole(myRole($pdo, $gid, $my_id, $grp))) {
            echo json_encode(['success' => false, 'message' => 'Недостатньо прав']); exit;
        }
        $pdo->prepare("DELETE FROM chat_group_requests WHERE group_id = :g AND user_id = :u")
            ->execute([':g' => $gid, ':u' => $uid]);
        if ($accept) {
            $pdo->prepare("INSERT IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (:g, :u, 'member')")
                ->execute([':g' => $gid, ':u' => $uid]);
            $them = userInfo($pdo, $uid);
            addSystemMessage($pdo, $gid, "✅ Заявку {$them['username']} прийнято — вітаємо!");
        }
        echo json_encode(['success' => true]);
        exit;
    }

    // ===== ВСТУП ЗА ПОСИЛАННЯМ (у канал — як підписник без прав) =====
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

        // 🔒 ПРИВАТНІ: за посиланням не вступаємо — показуємо модалку заявки
        if (!$already && ($grp['privacy'] ?: 'private') === 'private') {
            $st = $pdo->prepare("SELECT COUNT(*) FROM chat_group_members WHERE group_id = :g");
            $st->execute([':g' => $gid]);
            $cnt = intval($st->fetchColumn());
            $rq = $pdo->prepare("SELECT 1 FROM chat_group_requests WHERE group_id = :g AND user_id = :u");
            $rq->execute([':g' => $gid, ':u' => $my_id]);
            echo json_encode(['success' => true, 'private' => true, 'group' => [
                'id' => $gid, 'name' => $grp['name'], 'type' => $grp['type'],
                'owner_id' => intval($grp['owner_id']),
                'avatar' => $grp['avatar'], 'description' => $grp['description'],
                'members' => $cnt, 'privacy' => 'private',
                'has_request' => (bool)$rq->fetch()
            ]]);
            exit;
        }

        if (!$already) {
            $pdo->prepare("INSERT INTO chat_group_members (group_id, user_id, role) VALUES (:g, :u, 'member')")
                ->execute([':g' => $gid, ':u' => $my_id]);
            $me = userInfo($pdo, $my_id);
            if ($grp['type'] === 'channel') {
                addSystemMessage($pdo, $gid, "🔔 {$me['username']} підписався(лась) на канал");
            } else {
                addSystemMessage($pdo, $gid, "🔗 {$me['username']} приєднався(лась) за посиланням");
            }
        }
        echo json_encode(['success' => true, 'already' => $already, 'group' => [
            'id' => $gid, 'name' => $grp['name'], 'type' => $grp['type'], 'owner_id' => intval($grp['owner_id'])
        ]]);
        exit;
    }

    // ===== СПОВІЩЕННЯ =====
    if ($action === 'toggle_notifications') {
        $gid = intval($data['group_id'] ?? 0);
        $on = !empty($data['enabled']) ? 1 : 0;
        $pdo->prepare("UPDATE chat_group_members SET notifications = :n WHERE group_id = :g AND user_id = :u")
            ->execute([':n' => $on, ':g' => $gid, ':u' => $my_id]);
        echo json_encode(['success' => true, 'enabled' => $on]);
        exit;
    }

    // ===== ПОВІДОМЛЕННЯ (+ реакції) =====
    if ($action === 'get_messages') {
        $gid = intval($data['group_id'] ?? $_GET['group_id'] ?? 0);
        $since = intval($data['since_id'] ?? $_GET['since_id'] ?? 0);
        if ($gid <= 0) { echo json_encode(['success' => false]); exit; }

        $grp = getGroup($pdo, $gid);
        $stmt = $pdo->prepare("
            SELECT gm.id, gm.user_id, gm.username, gm.avatar, gm.message, gm.media_type, gm.media_url,
                   gm.created_at, gm.edited, gm.fwd_from, mem.role AS sender_role
            FROM chat_group_messages gm
            LEFT JOIN chat_group_members mem ON mem.group_id = gm.group_id AND mem.user_id = gm.user_id
            WHERE gm.group_id = :g AND gm.id > :s
            ORDER BY gm.id ASC LIMIT 100
        ");
        $stmt->execute([':g' => $gid, ':s' => $since]);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($messages as &$mm) {
            if ($grp && intval($mm['user_id']) === intval($grp['owner_id'])) $mm['sender_role'] = 'owner';
        }
        unset($mm);

        // 🔄 СИНХРОНІЗАЦІЯ: ids останніх 100 (щоб ловити видалення) + нещодавно відредаговані
        $idsSt = $pdo->prepare("SELECT id FROM chat_group_messages WHERE group_id = :g ORDER BY id DESC LIMIT 100");
        $idsSt->execute([':g' => $gid]);
        $ids = array_map('intval', $idsSt->fetchAll(PDO::FETCH_COLUMN));

        $edSt = $pdo->prepare("SELECT id, message FROM chat_group_messages
                               WHERE group_id = :g AND edited = 1
                               ORDER BY id DESC LIMIT 100");
        $edSt->execute([':g' => $gid]);
        $editedList = $edSt->fetchAll(PDO::FETCH_ASSOC);

        // ❤️ Реакції для останніх 100 повідомлень групи (щоб бачити зміни на старих)
        $rs = $pdo->prepare("
            SELECT r.message_id, r.emoji,
                   COUNT(*) AS cnt,
                   MAX(r.user_id = :me) AS mine
            FROM chat_group_reactions r
            WHERE r.message_id IN (
                SELECT id FROM (
                    SELECT id FROM chat_group_messages WHERE group_id = :g ORDER BY id DESC LIMIT 100
                ) AS last_ids
            )
            GROUP BY r.message_id, r.emoji
            ORDER BY MIN(r.created_at) ASC
        ");
        $rs->execute([':me' => $my_id, ':g' => $gid]);
        $reactions = $rs->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'messages' => $messages, 'reactions' => $reactions, 'ids' => $ids, 'edited_list' => $editedList, 'role_titles' => groupTitles($grp), 'my_id' => $my_id]);
        exit;
    }

    // ❤️ ПОСТАВИТИ/ЗНЯТИ РЕАКЦІЮ
    if ($action === 'toggle_reaction') {
        $mid = intval($data['message_id'] ?? 0);
        $emoji = trim(mb_substr($data['emoji'] ?? '', 0, 32));
        if ($mid <= 0 || $emoji === '') { echo json_encode(['success' => false]); exit; }

        // Перевірка членства через групу повідомлення
        $st = $pdo->prepare("SELECT group_id FROM chat_group_messages WHERE id = :m");
        $st->execute([':m' => $mid]);
        $gid = intval($st->fetchColumn());
        if (!$gid || !myRole($pdo, $gid, $my_id)) {
            echo json_encode(['success' => false, 'message' => 'Ви не учасник']); exit;
        }

        $st = $pdo->prepare("SELECT 1 FROM chat_group_reactions WHERE message_id = :m AND user_id = :u AND emoji = :e");
        $st->execute([':m' => $mid, ':u' => $my_id, ':e' => $emoji]);
        if ($st->fetch()) {
            $pdo->prepare("DELETE FROM chat_group_reactions WHERE message_id = :m AND user_id = :u AND emoji = :e")
                ->execute([':m' => $mid, ':u' => $my_id, ':e' => $emoji]);
            echo json_encode(['success' => true, 'state' => 'removed']);
        } else {
            $pdo->prepare("INSERT IGNORE INTO chat_group_reactions (message_id, user_id, emoji) VALUES (:m, :u, :e)")
                ->execute([':m' => $mid, ':u' => $my_id, ':e' => $emoji]);
            echo json_encode(['success' => true, 'state' => 'added']);
        }
        exit;
    }

    // ↪️ ПЕРЕСЛАТИ ПОВІДОМЛЕННЯ в іншу групу/канал
    if ($action === 'forward_message') {
        $mid = intval($data['message_id'] ?? 0);
        $to = intval($data['to_group_id'] ?? 0);
        if ($mid <= 0 || $to <= 0) { echo json_encode(['success' => false]); exit; }

        // Джерело: маю бути учасником групи, звідки пересилаю
        $st = $pdo->prepare("SELECT * FROM chat_group_messages WHERE id = :m");
        $st->execute([':m' => $mid]);
        $src = $st->fetch(PDO::FETCH_ASSOC);
        if (!$src || $src['media_type'] === 'system') { echo json_encode(['success' => false, 'message' => 'Не знайдено']); exit; }
        if (!myRole($pdo, intval($src['group_id']), $my_id)) {
            echo json_encode(['success' => false, 'message' => 'Ви не учасник вихідного чату']); exit;
        }

        // Призначення: ті ж права, що й на відправку
        $dst = getGroup($pdo, $to);
        if (!$dst) { echo json_encode(['success' => false, 'message' => 'Чат не знайдено']); exit; }
        $role = myRole($pdo, $to, $my_id, $dst);
        if (!$role) { echo json_encode(['success' => false, 'message' => 'Ви не учасник цього чату']); exit; }
        if ($dst['type'] === 'channel' && !isAdminRole($role)) {
            echo json_encode(['success' => false, 'message' => 'У канал пересилають лише адміністратори']); exit;
        }

        $uname = $data['username'] ?? ($_SESSION['username'] ?? 'Користувач');
        $uavatar = $data['avatar'] ?? null;
        // Хто справжній автор: якщо це вже переслане — зберігаємо первинного автора
        $origin = $src['fwd_from'] ?: $src['username'];

        $ins = $pdo->prepare("INSERT INTO chat_group_messages
            (group_id, user_id, username, avatar, message, media_type, media_url, fwd_from)
            VALUES (:g, :u, :n, :a, :m, :t, :url, :f)");
        $ins->execute([
            ':g' => $to, ':u' => $my_id,
            ':n' => mb_substr($uname, 0, 80), ':a' => $uavatar,
            ':m' => $src['message'], ':t' => $src['media_type'], ':url' => $src['media_url'],
            ':f' => mb_substr($origin, 0, 80)
        ]);
        echo json_encode(['success' => true, 'id' => intval($pdo->lastInsertId()), 'to_name' => $dst['name']]);
        exit;
    }

    // ✏️ РЕДАГУВАТИ ПОВІДОМЛЕННЯ (лише своє, лише текст)
    if ($action === 'edit_message') {
        $mid = intval($data['message_id'] ?? 0);
        $text = trim(mb_substr($data['text'] ?? '', 0, 2000));
        if ($mid <= 0 || $text === '') { echo json_encode(['success' => false]); exit; }

        $st = $pdo->prepare("SELECT group_id, user_id, media_type FROM chat_group_messages WHERE id = :m");
        $st->execute([':m' => $mid]);
        $msg = $st->fetch(PDO::FETCH_ASSOC);
        if (!$msg) { echo json_encode(['success' => false, 'message' => 'Не знайдено']); exit; }
        if (intval($msg['user_id']) !== $my_id) { echo json_encode(['success' => false, 'message' => 'Можна редагувати лише свої повідомлення']); exit; }
        if ($msg['media_type'] !== 'text') { echo json_encode(['success' => false, 'message' => 'Це повідомлення не можна редагувати']); exit; }

        $pdo->prepare("UPDATE chat_group_messages SET message = :t, edited = 1 WHERE id = :m")
            ->execute([':t' => $text, ':m' => $mid]);
        echo json_encode(['success' => true]);
        exit;
    }

    // 🗑 ВИДАЛИТИ ПОВІДОМЛЕННЯ (своє — завжди; чуже — адмінам, але не повідомлення власника)
    if ($action === 'delete_message') {
        $mid = intval($data['message_id'] ?? 0);
        if ($mid <= 0) { echo json_encode(['success' => false]); exit; }

        $st = $pdo->prepare("SELECT group_id, user_id FROM chat_group_messages WHERE id = :m");
        $st->execute([':m' => $mid]);
        $msg = $st->fetch(PDO::FETCH_ASSOC);
        if (!$msg) { echo json_encode(['success' => false, 'message' => 'Не знайдено']); exit; }

        $gid = intval($msg['group_id']);
        $grp = getGroup($pdo, $gid);
        $myR = myRole($pdo, $gid, $my_id, $grp);
        $isMine = intval($msg['user_id']) === $my_id;
        $targetIsOwner = $grp && intval($msg['user_id']) === intval($grp['owner_id']);

        $can = $isMine
            || ($myR === 'owner')
            || (isAdminRole($myR) && !$targetIsOwner);
        if (!$can) { echo json_encode(['success' => false, 'message' => 'Недостатньо прав']); exit; }

        $pdo->prepare("DELETE FROM chat_group_messages WHERE id = :m")->execute([':m' => $mid]);
        $pdo->prepare("DELETE FROM chat_group_reactions WHERE message_id = :m")->execute([':m' => $mid]);
        echo json_encode(['success' => true]);
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
        if ($grp['type'] === 'channel' && !isAdminRole($role)) {
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

    // 🎨 СТІКЕР (без завантаження — URL зі стікерпаку сайту)
    if ($action === 'send_sticker') {
        $gid = intval($data['group_id'] ?? 0);
        $url = trim($data['url'] ?? '');
        // Дозволяємо лише локальні шляхи сайту
        if ($gid <= 0 || $url === '' || preg_match('#^(https?:)?//#', $url) || strpos($url, '..') !== false
            || !(strpos($url, 'img/') === 0 || strpos($url, 'uploads/') === 0)) {
            echo json_encode(['success' => false, 'message' => 'Невірний стікер']); exit;
        }
        $grp = getGroup($pdo, $gid);
        if (!$grp) { echo json_encode(['success' => false]); exit; }
        $role = myRole($pdo, $gid, $my_id, $grp);
        if (!$role) { echo json_encode(['success' => false, 'message' => 'Ви не учасник']); exit; }
        if ($grp['type'] === 'channel' && !isAdminRole($role)) {
            echo json_encode(['success' => false, 'message' => 'У каналі публікують лише адміністратори']); exit;
        }

        $uname = $data['username'] ?? ($_SESSION['username'] ?? 'Користувач');
        $uavatar = $data['avatar'] ?? null;
        $stmt = $pdo->prepare("INSERT INTO chat_group_messages (group_id, user_id, username, avatar, message, media_type, media_url)
                               VALUES (:g, :u, :n, :a, '', 'sticker', :url)");
        $stmt->execute([':g' => $gid, ':u' => $my_id, ':n' => mb_substr($uname, 0, 80), ':a' => $uavatar, ':url' => mb_substr($url, 0, 255)]);
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
        if ($grp['type'] === 'channel' && !isAdminRole($role)) {
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
            $st = $pdo->prepare("SELECT 1 FROM chat_group_members WHERE group_id = :g AND user_id = :u");
            $st->execute([':g' => $gid, ':u' => $my_id]);
            if (!$st->fetch()) {
                $pdo->prepare("INSERT INTO chat_group_members (group_id, user_id, role) VALUES (:g, :u, 'member')")
                    ->execute([':g' => $gid, ':u' => $my_id]);
                $grp = getGroup($pdo, $gid);
                $me = userInfo($pdo, $my_id);
                if ($grp && $grp['type'] === 'channel') addSystemMessage($pdo, $gid, "🔔 {$me['username']} підписався(лась) на канал");
                else addSystemMessage($pdo, $gid, "👋 {$me['username']} приєднався(лась)");
            }
        }
        echo json_encode(['success' => true]);
        exit;
    }

    if ($action === 'leave') {
        $gid = intval($data['group_id'] ?? 0);
        $grp = getGroup($pdo, $gid);
        if ($grp && intval($grp['owner_id']) === $my_id) {
            echo json_encode(['success' => false, 'message' => 'Власник не може вийти. Видаліть або передайте права.']); exit;
        }
        if ($gid > 0) {
            $pdo->prepare("DELETE FROM chat_group_members WHERE group_id = :g AND user_id = :u")
                ->execute([':g' => $gid, ':u' => $my_id]);
            $me = userInfo($pdo, $my_id);
            if ($grp && $grp['type'] === 'channel') addSystemMessage($pdo, $gid, "🔕 {$me['username']} відписався(лась) від каналу");
            else addSystemMessage($pdo, $gid, "🚪 {$me['username']} вийшов(ла) з групи");
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
            $pdo->prepare("DELETE FROM chat_group_reactions WHERE message_id IN (SELECT id FROM chat_group_messages WHERE group_id = " . intval($gid) . ")");
            $pdo->prepare("DELETE FROM chat_group_messages WHERE group_id = :g")->execute([':g' => $gid]);
            // Відв'язуємо від каналів, де ця група була обговоренням
            $pdo->prepare("UPDATE chat_groups SET linked_group_id = NULL WHERE linked_group_id = :g")->execute([':g' => $gid]);
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
