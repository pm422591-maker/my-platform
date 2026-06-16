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
        if (time() - ($s['last_seen'] ?? 0) > 60) { unset($streams[$uid]); continue; }

        // Прибираємо глядачів, які не оновлювали присутність понад 40 сек,
        // і перераховуємо актуальну кількість глядачів.
        if (isset($s['watchers']) && is_array($s['watchers'])) {
            foreach ($s['watchers'] as $wid => $seen) {
                if (time() - (int)$seen > 40) unset($streams[$uid]['watchers'][$wid]);
            }
            // viewers = унікальні живі глядачі + сам стрімер
            $streams[$uid]['viewers'] = count($streams[$uid]['watchers']) + 1;
        }
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
            'watchers'   => $streams[$my_id]['watchers'] ?? [],
            'viewers'    => (isset($streams[$my_id]['watchers']) ? count($streams[$my_id]['watchers']) : 0) + 1,
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

// 👁️ Глядач приєднується / оновлює присутність на стрімі.
// Викликається при відкритті плеєра і періодично (кожні ~15 сек), щоб лічильник був живим.
elseif ($action === 'watch') {
    $targetId = (string)($data['stream_id'] ?? '');
    $resp = withStreams($streams_file, function($streams) use ($my_id, $targetId) {
        if ($targetId === '' || !isset($streams[$targetId])) {
            return ['streams' => $streams, 'response' => ['success' => false, 'message' => 'Стрім завершено або не існує']];
        }
        // Стрімер не рахується як окремий глядач
        if ($targetId !== $my_id) {
            if (!isset($streams[$targetId]['watchers']) || !is_array($streams[$targetId]['watchers'])) {
                $streams[$targetId]['watchers'] = [];
            }
            $streams[$targetId]['watchers'][$my_id] = time();
        }
        $streams[$targetId]['viewers'] = count($streams[$targetId]['watchers'] ?? []) + 1;
        $s = $streams[$targetId];
        return ['streams' => $streams, 'response' => ['success' => true, 'stream' => [
            'user_id'  => $s['user_id'],
            'streamer' => $s['streamer'],
            'avatar'   => $s['avatar'],
            'title'    => $s['title'],
            'subtitle' => $s['subtitle'],
            'category' => $s['category'],
            'viewers'  => $s['viewers'],
            'started_at' => $s['started_at'] ?? time()
        ]]];
    });
    echo json_encode($resp ?: ['success' => false]);
}

// 👋 Глядач залишає стрім.
elseif ($action === 'leave') {
    $targetId = (string)($data['stream_id'] ?? '');
    $resp = withStreams($streams_file, function($streams) use ($my_id, $targetId) {
        if ($targetId !== '' && isset($streams[$targetId]['watchers'][$my_id])) {
            unset($streams[$targetId]['watchers'][$my_id]);
            $streams[$targetId]['viewers'] = count($streams[$targetId]['watchers']) + 1;
        }
        return ['streams' => $streams, 'response' => ['success' => true]];
    });
    echo json_encode($resp ?: ['success' => false]);
}

else {
    echo json_encode(['success' => false, 'message' => 'Unknown action']);
}
?>
