<?php
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not authorized']);
    exit;
}

$my_id = $_SESSION['user_id'];
$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? $_GET['action'] ?? '';
$target_id = $data['target_id'] ?? null;

// БЕРЕМО ДАНІ КОРИСТУВАЧА
$caller_name = $data['caller_name'] ?? $_SESSION['username'] ?? $_SESSION['user_name'] ?? 'Користувач';
$caller_avatar = $data['caller_avatar'] ?? $_SESSION['avatar'] ?? 'img/default_avatar.png';

$calls_file = 'active_calls.json';
$calls = file_exists($calls_file) ? json_decode(file_get_contents($calls_file), true) : [];
if (!is_array($calls)) $calls = [];

// ==========================================
// ОБРОБКА ДІЙ ВІД БРАУЗЕРА
// ==========================================

if ($action === 'start') {
    // ПОЧАТОК ДЗВІНКА
    if ($target_id) {
        $calls[$target_id] = [
            'caller_id'     => $my_id,
            'caller_name'   => $caller_name,
            'caller_avatar' => $caller_avatar,
            'sdp_offer'     => $data['sdp'] ?? null,
            'status'        => 'ringing',
            'time'          => time(),
            'caller_mic_off'=> false, // Мікрофон увімкнено при старті
            'target_mic_off'=> false
        ];
        file_put_contents($calls_file, json_encode($calls));
    }
    echo json_encode(['success' => true]);
} 

elseif ($action === 'answer') {
    // ВІДПОВІДЬ НА ДЗВІНОК
    if (isset($calls[$my_id])) {
        $calls[$my_id]['status'] = 'active';
        $calls[$my_id]['time'] = time(); 
        $calls[$my_id]['sdp_answer'] = $data['sdp'] ?? null;
        file_put_contents($calls_file, json_encode($calls));
    }
    echo json_encode(['success' => true]);
}

elseif ($action === 'toggle_mic') {
    // 🔥 НОВЕ: ПЕРЕМИКАННЯ МІКРОФОНА
    $is_off = (bool)($data['mic_off'] ?? false);
    $changed = false;

    // Якщо я — той, кому дзвонили (Target)
    if (isset($calls[$my_id])) {
        $calls[$my_id]['target_mic_off'] = $is_off;
        $changed = true;
    } else {
        // Якщо я — той, хто дзвонив (Caller)
        foreach ($calls as $tid => $call) {
            if ($call['caller_id'] == $my_id) {
                $calls[$tid]['caller_mic_off'] = $is_off;
                $changed = true;
                break;
            }
        }
    }

    if ($changed) {
        file_put_contents($calls_file, json_encode($calls));
    }
    echo json_encode(['success' => true]);
}

elseif ($action === 'end') {
    // ЗАВЕРШЕННЯ ДЗВІНКА
    if (isset($calls[$my_id])) {
        unset($calls[$my_id]); 
    }
    
    foreach ($calls as $target => $call) {
        if ($call['caller_id'] == $my_id) {
            unset($calls[$target]);
        }
    }
    file_put_contents($calls_file, json_encode($calls));
    echo json_encode(['success' => true]);
} 

elseif ($action === 'check') {
    // РАДАР (Кожні 1.5 сек)
    $changed = false;
    
    // Очищення старих дзвінків
    foreach ($calls as $id => $call) {
        if (time() - $call['time'] > 65 && $call['status'] === 'ringing') {
            unset($calls[$id]);
            $changed = true;
        }
    }
    if ($changed) file_put_contents($calls_file, json_encode($calls));

    $response = [
        'is_calling'     => false,
        'call_answered'  => false,
        'call_ended'     => true,
        'partner_mic_off'=> false // Статус мікрофона партнера за замовчуванням
    ];

    // 1. ПЕРЕВІРКА ВХІДНОГО ДЗВІНКА (Я - Target)
    if (isset($calls[$my_id])) {
        $response['call_ended'] = false; 
        $response['partner_mic_off'] = $calls[$my_id]['caller_mic_off'] ?? false; // Чи вимкнув мікрофон Caller

        if ($calls[$my_id]['status'] === 'ringing') {
            $response['is_calling'] = true;
            $response['caller_id'] = $calls[$my_id]['caller_id'];
            $response['caller_name'] = $calls[$my_id]['caller_name'];
            $response['caller_avatar'] = $calls[$my_id]['caller_avatar'];
            $response['sdp_offer'] = $calls[$my_id]['sdp_offer'] ?? null;
        }
    }

    // 2. ПЕРЕВІРКА ВИХІДНОГО ДЗВІНКА (Я - Caller)
    foreach ($calls as $target => $call) {
        if ($call['caller_id'] == $my_id) {
            $response['call_ended'] = false; 
            $response['partner_mic_off'] = $call['target_mic_off'] ?? false; // Чи вимкнув мікрофон Target

            if ($call['status'] === 'active') {
                $response['call_answered'] = true; 
                $response['active_time'] = time() - $call['time']; 
                $response['sdp_answer'] = $call['sdp_answer'] ?? null;
            }
            break;
        }
    }

    echo json_encode($response);
}
?>