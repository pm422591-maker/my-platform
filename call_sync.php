<?php
// call_sync.php — СТАБІЛЬНА СИГНАЛІЗАЦІЯ ДЗВІНКІВ (Telegram-style)
// ✨ Нове: атомарний запис через flock (без гонок), обмін ICE-кандидатами (trickle ICE)
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not authorized']);
    exit;
}

$my_id = $_SESSION['user_id'];
$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? $_GET['action'] ?? '';
$target_id = $data['target_id'] ?? null;

$caller_name = $data['caller_name'] ?? $_SESSION['username'] ?? $_SESSION['user_name'] ?? 'Користувач';
$caller_avatar = $data['caller_avatar'] ?? $_SESSION['avatar'] ?? 'img/default_avatar.png';

$calls_file = __DIR__ . '/active_calls.json';

// 🔒 АТОМАРНЕ ЧИТАННЯ-ЗМІНА-ЗАПИС (захист від втрати даних при одночасних запитах)
function withCalls($file, callable $fn, $writeBack = true) {
    $fp = fopen($file, 'c+');
    if (!$fp) return null;
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $calls = json_decode($raw, true);
    if (!is_array($calls)) $calls = [];

    $result = $fn($calls); // $calls передається за посиланням через use? Ні — повертаємо масивом

    if ($writeBack && is_array($result['calls'] ?? null)) {
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($result['calls']));
        fflush($fp);
    }
    flock($fp, LOCK_UN);
    fclose($fp);
    return $result['response'] ?? null;
}

if ($action === 'start') {
    withCalls($calls_file, function($calls) use ($target_id, $my_id, $caller_name, $caller_avatar, $data) {
        if ($target_id) {
            $calls[$target_id] = [
                'caller_id'      => $my_id,
                'caller_name'    => $caller_name,
                'caller_avatar'  => $caller_avatar,
                'sdp_offer'      => $data['sdp'] ?? null,
                'is_video'       => $data['is_video'] ?? false,
                'status'         => 'ringing',
                'time'           => time(),
                'caller_mic_off' => false,
                'target_mic_off' => false,
                // ❄️ ICE-кандидати для trickle ICE (швидке та надійне з'єднання)
                'caller_candidates' => [],
                'target_candidates' => []
            ];
        }
        return ['calls' => $calls, 'response' => ['success' => true]];
    });
    echo json_encode(['success' => true]);
}

elseif ($action === 'answer') {
    withCalls($calls_file, function($calls) use ($my_id, $data) {
        if (isset($calls[$my_id])) {
            $calls[$my_id]['status'] = 'active';
            $calls[$my_id]['time'] = time();
            $calls[$my_id]['sdp_answer'] = $data['sdp'] ?? null;
        }
        return ['calls' => $calls];
    });
    echo json_encode(['success' => true]);
}

// ❄️ НОВЕ: ПРИЙОМ ICE-КАНДИДАТІВ (trickle ICE — як у Telegram/WhatsApp)
elseif ($action === 'candidate') {
    $cand = $data['candidate'] ?? null;
    withCalls($calls_file, function($calls) use ($my_id, $cand) {
        if ($cand === null) return ['calls' => $calls];
        // Я — Target (мені дзвонять)
        if (isset($calls[$my_id])) {
            $calls[$my_id]['target_candidates'][] = $cand;
        } else {
            // Я — Caller
            foreach ($calls as $tid => $call) {
                if ($call['caller_id'] == $my_id) {
                    $calls[$tid]['caller_candidates'][] = $cand;
                    break;
                }
            }
        }
        return ['calls' => $calls];
    });
    echo json_encode(['success' => true]);
}

elseif ($action === 'toggle_mic') {
    $is_off = (bool)($data['mic_off'] ?? false);
    withCalls($calls_file, function($calls) use ($my_id, $is_off) {
        if (isset($calls[$my_id])) {
            $calls[$my_id]['target_mic_off'] = $is_off;
        } else {
            foreach ($calls as $tid => $call) {
                if ($call['caller_id'] == $my_id) {
                    $calls[$tid]['caller_mic_off'] = $is_off;
                    break;
                }
            }
        }
        return ['calls' => $calls];
    });
    echo json_encode(['success' => true]);
}

elseif ($action === 'end') {
    withCalls($calls_file, function($calls) use ($my_id) {
        if (isset($calls[$my_id])) unset($calls[$my_id]);
        foreach ($calls as $target => $call) {
            if ($call['caller_id'] == $my_id) unset($calls[$target]);
        }
        return ['calls' => $calls];
    });
    echo json_encode(['success' => true]);
}

elseif ($action === 'check') {
    // РАДАР (поллінг). Параметри: cand_idx — скільки кандидатів партнера вже отримано
    $cand_idx = isset($_GET['cand_idx']) ? intval($_GET['cand_idx']) : intval($data['cand_idx'] ?? 0);

    $response = withCalls($calls_file, function($calls) use ($my_id, $cand_idx) {
        $changed = false;
        foreach ($calls as $id => $call) {
            if (time() - $call['time'] > 65 && $call['status'] === 'ringing') {
                unset($calls[$id]);
                $changed = true;
            }
        }

        $resp = [
            'is_calling'      => false,
            'call_answered'   => false,
            'call_ended'      => true,
            'partner_mic_off' => false,
            'candidates'      => [],  // ❄️ нові кандидати партнера
            'cand_idx'        => $cand_idx
        ];

        // 1. Я — Target
        if (isset($calls[$my_id])) {
            $c = $calls[$my_id];
            $resp['call_ended'] = false;
            $resp['partner_mic_off'] = $c['caller_mic_off'] ?? false;

            // Кандидати від Caller'а, які я ще не бачив
            $all = $c['caller_candidates'] ?? [];
            if (count($all) > $cand_idx) {
                $resp['candidates'] = array_slice($all, $cand_idx);
                $resp['cand_idx'] = count($all);
            }

            if ($c['status'] === 'ringing') {
                $resp['is_calling'] = true;
                $resp['caller_id'] = $c['caller_id'];
                $resp['caller_name'] = $c['caller_name'];
                $resp['caller_avatar'] = $c['caller_avatar'];
                $resp['is_video'] = $c['is_video'] ?? false;
                $resp['sdp_offer'] = $c['sdp_offer'] ?? null;
            }
        }

        // 2. Я — Caller
        foreach ($calls as $target => $call) {
            if ($call['caller_id'] == $my_id) {
                $resp['call_ended'] = false;
                $resp['partner_mic_off'] = $call['target_mic_off'] ?? false;

                $all = $call['target_candidates'] ?? [];
                if (count($all) > $cand_idx) {
                    $resp['candidates'] = array_slice($all, $cand_idx);
                    $resp['cand_idx'] = count($all);
                }

                if ($call['status'] === 'active') {
                    $resp['call_answered'] = true;
                    $resp['active_time'] = time() - $call['time'];
                    $resp['sdp_answer'] = $call['sdp_answer'] ?? null;
                }
                break;
            }
        }

        return ['calls' => $calls, 'response' => $resp];
    });

    echo json_encode($response);
}
?>
