<?php
// get_posts.php
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');
session_start();

try {
    require_once __DIR__ . '/db_connect.php'; // utf8mb4 + безпечні налаштування

    $user_id = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : 0;

    // Очищення старих заявок — виконується рідко (1% запитів), щоб не гальмувати кожне читання
    if (rand(1, 100) === 1) {
        $pdo->exec("DELETE FROM posts WHERE post_type = 'requests' AND created_at <= NOW() - INTERVAL 1 HOUR");
    }

    // --- ПАГИНАЦИЯ (порционная загрузка) ---
    $limit = 10; 
    $page = isset($_GET['page']) ? intval($_GET['page']) : 1;
    if ($page < 1) $page = 1;
    $offset = ($page - 1) * $limit; 

    // Отримуємо тип (requests, feed або blog)
    $post_type = isset($_GET['type']) ? $_GET['type'] : 'feed';

    // 🛡️ ФІКС БЛОГУ: блог — це сторінка КОНКРЕТНОГО користувача.
    // Без цього фільтра сюди потрапляли blog-пости ВСІХ юзерів.
    // blog_user_id передає фронтенд; якщо його немає — беремо власника сесії.
    $blog_user_id = 0;
    if ($post_type === 'blog') {
        $blog_user_id = isset($_GET['blog_user_id']) ? intval($_GET['blog_user_id']) : $user_id;
        if ($blog_user_id <= 0) {
            // Немає ні параметра, ні сесії — нічого показувати
            echo json_encode([]);
            exit;
        }
    }

    // ✨ НОВЕ: Отримуємо фільтри з запиту (якщо їх немає, за замовчуванням 'any')
    $filter_age = isset($_GET['filter_age']) ? $_GET['filter_age'] : 'any';
    $filter_comm = isset($_GET['filter_comm']) ? $_GET['filter_comm'] : 'any';
    $filter_level = isset($_GET['filter_level']) ? $_GET['filter_level'] : 'any';
    $filter_lang = isset($_GET['filter_lang']) ? $_GET['filter_lang'] : 'any';

    // Базовий запит без сортування і лімітів
    $query = "
    SELECT p.*,
           (SELECT COALESCE(SUM(vote_type), 0) FROM post_votes WHERE post_id = p.id) as vote_count,
           (SELECT vote_type FROM post_votes WHERE post_id = p.id AND user_id = :uid LIMIT 1) as my_vote,
           (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
    FROM posts p
    WHERE p.post_type = :ptype
    ";

    // 🛡️ Фільтр блогу: тільки пости власника блогу
    if ($post_type === 'blog') {
        $query .= " AND p.user_id = :blog_uid";
    }

    // ✨ НОВЕ: Динамічно додаємо умови, якщо це заявки і значення не 'any'
    if ($post_type === 'requests') {
        if ($filter_age !== 'any') {
            $query .= " AND p.filter_age = :f_age";
        }
        if ($filter_comm !== 'any') {
            $query .= " AND p.filter_comm = :f_comm";
        }
        if ($filter_level !== 'any') {
            $query .= " AND p.filter_level = :f_level";
        }
        if ($filter_lang !== 'any') {
            $query .= " AND p.filter_lang = :f_lang";
        }
    }

    // Додаємо сортування та пагінацію в кінці
    $query .= " ORDER BY p.created_at DESC LIMIT :limit OFFSET :offset";

    $stmt = $pdo->prepare($query);

    // Прив'язуємо базові параметри
    $stmt->bindValue(':uid', $user_id, PDO::PARAM_INT);
    $stmt->bindValue(':ptype', $post_type, PDO::PARAM_STR); 
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

    // 🛡️ Прив'язуємо власника блогу
    if ($post_type === 'blog') {
        $stmt->bindValue(':blog_uid', $blog_user_id, PDO::PARAM_INT);
    }

    // ✨ НОВЕ: Прив'язуємо параметри фільтрів, ТІЛЬКИ якщо вони були додані в запит
    if ($post_type === 'requests') {
        if ($filter_age !== 'any') $stmt->bindValue(':f_age', $filter_age, PDO::PARAM_STR);
        if ($filter_comm !== 'any') $stmt->bindValue(':f_comm', $filter_comm, PDO::PARAM_STR);
        if ($filter_level !== 'any') $stmt->bindValue(':f_level', $filter_level, PDO::PARAM_STR);
        if ($filter_lang !== 'any') $stmt->bindValue(':f_lang', $filter_lang, PDO::PARAM_STR);
    }

    $stmt->execute();
    
    $posts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($posts)) {
        echo json_encode([]);
        exit;
    }

    $post_ids = [];
    $user_ids = [];
    foreach ($posts as $p) {
        $post_ids[] = $p['id'];
        if (!empty($p['user_id'])) {
            $user_ids[$p['user_id']] = true;
        }
    }
    $user_ids = array_keys($user_ids);

    $usersMap = [];
    if (!empty($user_ids)) {
        $inQuery = implode(',', array_fill(0, count($user_ids), '?'));
        $uStmt = $pdo->prepare("SELECT * FROM users WHERE id IN ($inQuery)");
        $uStmt->execute($user_ids);
        foreach ($uStmt->fetchAll(PDO::FETCH_ASSOC) as $u) {
            $usersMap[$u['id']] = $u;
        }
    }

    $giftsMap = [];
    $inPosts = implode(',', array_fill(0, count($post_ids), '?'));
    $gStmt = $pdo->prepare("SELECT post_id, gift_icon as icon FROM post_gifts WHERE post_id IN ($inPosts)");
    $gStmt->execute($post_ids);
    foreach ($gStmt->fetchAll(PDO::FETCH_ASSOC) as $g) {
        $giftsMap[$g['post_id']][] = ['icon' => $g['icon']];
    }

    foreach ($posts as &$post) {
        $pid = $post['id'];
        $uid = $post['user_id'];

        $post['current_viewer_id'] = $user_id;
        $post['gifts'] = isset($giftsMap[$pid]) ? $giftsMap[$pid] : [];

        if (!empty($uid) && isset($usersMap[$uid])) {
            $freshUser = $usersMap[$uid];
            
            if (!empty($freshUser['username'])) {
                $post['author_name'] = $freshUser['username'];
            }
            if (!empty($freshUser['avatar_url'])) {
                $post['avatar_url'] = $freshUser['avatar_url'];
            } elseif (!empty($freshUser['avatar'])) {
                $post['avatar_url'] = $freshUser['avatar'];
            }
        }
    }
    unset($post);

    echo json_encode($posts);
} catch (Exception $e) {
    error_log('[get_posts] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Помилка сервера']);
}
?>