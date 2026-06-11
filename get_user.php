<?php
// 1. ЗАГОЛОВКИ ДЛЯ РОБОТИ З DOCKER ТА FRONTEND
require_once __DIR__ . '/cors_session.php';
session_start();

ini_set('display_errors', 0);
error_reporting(0);

header('Content-Type: application/json; charset=utf-8');

$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: ''; 

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $currentUserId = $_SESSION['user_id'] ?? null;
    $requestedUserId = $_GET['id'] ?? null;
    $targetId = $requestedUserId ? $requestedUserId : $currentUserId;

    if ($targetId) {
        $isOwnProfile = ($currentUserId && $targetId == $currentUserId);

        $sql = "SELECT username, `user`, avatar_url, banner_url, background_url, created_at, bio, country_code, languages_icons, secondary_email, grad_color_left, grad_color_right, status_start_hour, status_end_hour, status_last_updated, badges, roblox_id, roblox_data, roblox_inventory, steam_id, premium_until FROM users WHERE id = ?";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$targetId]);
        $res = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($res) {
            // --- НОВИЙ БЛОК: СТАТИСТИКА ТА ПІДПИСКИ ---
            
            // 1. Скільки людей підписані на цей профіль
            $stmtF = $pdo->prepare("SELECT COUNT(*) FROM user_follows WHERE followed_id = ?");
            $stmtF->execute([$targetId]);
            $followersCount = $stmtF->fetchColumn();

            // 2. На скількох людей підписаний цей профіль
            $stmtG = $pdo->prepare("SELECT COUNT(*) FROM user_follows WHERE follower_id = ?");
            $stmtG->execute([$targetId]);
            $followingCount = $stmtG->fetchColumn();

            // 3. Репутація (рахуємо суму лайків під усіма постами цього автора)
            $stmtR = $pdo->prepare("
                SELECT COALESCE(SUM(v.vote_type), 0) 
                FROM post_votes v 
                JOIN posts p ON v.post_id = p.id 
                WHERE p.user_id = ? AND v.vote_type = 1
            ");
            $stmtR->execute([$targetId]);
            $reputation = $stmtR->fetchColumn();

            // 4. Чи підписаний поточний глядач на цей профіль (для кнопки)
            $isFollowing = false;
            if ($currentUserId && !$isOwnProfile) {
                $stmtCheck = $pdo->prepare("SELECT 1 FROM user_follows WHERE follower_id = ? AND followed_id = ?");
                $stmtCheck->execute([$currentUserId, $targetId]);
                $isFollowing = (bool)$stmtCheck->fetch();
            }
            // ------------------------------------------

            echo json_encode([
                'success' => true,
                'is_own_profile' => $isOwnProfile,
                'is_following'   => $isFollowing, // Статус для кнопки
                'followers_count' => $followersCount, // Цифра для UI
                'following_count' => $followingCount, // Цифра для UI
                'reputation'     => $reputation,     // Цифра для UI
                'username'           => $res['username'],
                'user'               => $res['user'],
                'created_at'         => $res['created_at'],
                'avatar_url'         => $res['avatar_url'],
                'banner_url'         => $res['banner_url'],
                'background_url'     => $res['background_url'],
                'bio'                => $res['bio'],
                'country_code'       => $res['country_code'],
                'languages_icons'    => $res['languages_icons'],
                'secondary_email'    => $res['secondary_email'],
                'grad_color_left'    => $res['grad_color_left'],
                'grad_color_right'   => $res['grad_color_right'],
                'status_start_hour'  => $res['status_start_hour'],
                'status_end_hour'    => $res['status_end_hour'],
                'status_last_updated' => $res['status_last_updated'],
                "badges"             => $res['badges'],
                "roblox_id"   => $res['roblox_id'], 
                "roblox_data" => $res['roblox_data'],
                'roblox_inventory'   => $res['roblox_inventory'],
                "steam_id" => $res['steam_id'],
                "premium_until" => $res['premium_until'],
                "is_premium" => ($res['premium_until'] && new DateTime($res['premium_until']) > new DateTime())
            
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'User not found in database']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Not authorized (Session is empty)']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
exit;