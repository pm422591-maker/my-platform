<?php
// streams.php — ПУБЛІКАЦІЯ ТА СПИСОК ЖИВИХ СТРІМІВ
// Дії: start | stop | heartbeat | list
session_start();
header('Content-Type: application/json; charset=utf-8');

$streams_file = __DIR__ . '/active_streams.json';
$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? $_GET['action'] ?? 'list';

// 🔒 Атомарне читання/запис через flock
function withStreams($file, callable $fn) {
    $fp = fopen($file, 'c+');
    if (!$fp) return null;
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $streams = json_decode($raw, true);
    if (!is_array($streams)) $streams = [];

    // Авто-очищення: стрім без heartbeat понад 60 сек вважається завершеним
    foreach ($streams as $uid => $s) {
        if (time() - ($s['last_seen'] ?? 0) > 60) unset($streams[$uid]);
    }

    $result = $fn($streams);

    if (is_array($result['streams'] ?? null)) {
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($result['streams']));
        fflush($fp);
    }
    flock($fp, LOCK_UN);
    fclose($fp);
    return $result['response'] ?? null;
}

// Публічний список — без авторизації
if ($action === 'list') {
    $resp = withStreams($streams_file, function($streams) {
        $list = array_values($streams);
        // Свіжі стріми зверху
        usort($list, fn($a, $b) => ($b['started_at'] ?? 0) - ($a['started_at'] ?? 0));
        return ['streams' => $streams, 'response' => ['success' => true, 'streams' => $list]];
    });
    echo json_encode($resp ?: ['success' => false, 'streams' => []]);
    exit;
}

// Решта дій вимагають логіну
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not authorized']);
    exit;
}
$my_id = (string)$_SESSION['user_id'];

if ($action === 'start') {
    $title    = trim(mb_substr($data['title'] ?? 'Мій стрім', 0, 100));
    $subtitle = trim(mb_substr($data['subtitle'] ?? '', 0, 160));
    $category = trim(mb_substr($data['category'] ?? 'Just Chatting', 0, 40));
    $name     = trim(mb_substr($data['streamer'] ?? ($_SESSION['username'] ?? 'Streamer'), 0, 40));
    $avatar   = $data['avatar'] ?? 'img/default_avatar.png';

    $resp = withStreams($streams_file, function($streams) use ($my_id, $title, $subtitle, $category, $name, $avatar) {
        $streams[$my_id] = [
            'user_id'    => $my_id,
            'streamer'   => $name ?: 'Streamer',
            'avatar'     => $avatar,
            'title'      => $title ?: 'Мій стрім',
            'subtitle'   => $subtitle,
            'category'   => $category,
            'viewers'    => $streams[$my_id]['viewers'] ?? 1,
            'started_at' => $streams[$my_id]['started_at'] ?? time(),
            'last_seen'  => time()
        ];
        return ['streams' => $streams, 'response' => ['success' => true, 'stream' => $streams[$my_id]]];
    });
    echo json_encode($resp ?: ['success' => false]);
}

elseif ($action === 'heartbeat') {
    $resp = withStreams($streams_file, function($streams) use ($my_id, $data) {
        if (isset($streams[$my_id])) {
            $streams[$my_id]['last_seen'] = time();
            if (!empty($data['title']))    $streams[$my_id]['title']    = mb_substr($data['title'], 0, 100);
            if (isset($data['subtitle']))  $streams[$my_id]['subtitle'] = mb_substr($data['subtitle'], 0, 160);
        }
        return ['streams' => $streams, 'response' => ['success' => true, 'live' => isset($streams[$my_id])]];
    });
    echo json_encode($resp ?: ['success' => false]);
}

elseif ($action === 'stop') {
    $resp = withStreams($streams_file, function($streams) use ($my_id) {
        unset($streams[$my_id]);
        return ['streams' => $streams, 'response' => ['success' => true]];
    });
    echo json_encode($resp ?: ['success' => false]);
}

else {
    echo json_encode(['success' => false, 'message' => 'Unknown action']);
}
?>
