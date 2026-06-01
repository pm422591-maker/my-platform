<?php
// Примусово показуємо всі помилки
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

try {
    // 1. ПЕРЕВІРКА CURL (найчастіша причина білого екрану в Docker)
    if (!function_exists('curl_init')) {
        throw new Exception("Бібліотека cURL не встановлена або вимкнена у вашому PHP!");
    }

    session_start();

    // 2. ЧИТАЄМО ДАНІ ВІД JS
    $json = file_get_contents('php://input');
    $request_data = json_decode($json, true);

    if (!$request_data || !isset($request_data['code'])) {
        throw new Exception('Код авторизації не отримано сервером. Що прийшло: ' . $json);
    }

    $authCode = $request_data['code'];

    // 3. КЛЮЧІ ROBLOX
    $client_id = '3297832364838545643';
    $client_secret = 'RBX-z6LMMDaBo0ydp7J9OFOkXrw_DkNWsQmUm4UEKbyCST2jdA3Hpx3885ljFCsSv0ky';
    
    // ИСПРАВЛЕНО: Теперь здесь твой официальный домен с HTTPS
    $redirect_uri = 'https://syncora.cyou/profile.html'; 

    // 4. ЗАПИТ НА ТОКЕН
    $token_url = 'https://apis.roblox.com/oauth/v1/token';
    $post_fields = http_build_query([
        'client_id'     => $client_id,
        'client_secret' => $client_secret,
        'grant_type'    => 'authorization_code',
        'code'          => $authCode,
        'redirect_uri'  => $redirect_uri
    ]);

    $ch = curl_init($token_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post_fields);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);

    $token_response = curl_exec($ch);
    $token_error = curl_error($ch);
    curl_close($ch);

    if ($token_error) {
        throw new Exception('cURL помилка (токен): ' . $token_error);
    }

    $token_data = json_decode($token_response, true);

    if (!isset($token_data['access_token'])) {
        echo json_encode(['success' => false, 'message' => 'Roblox відхилив запит', 'details' => $token_data]);
        exit;
    }

    $access_token = $token_data['access_token'];

    // 5. ЗАПИТ ПРОФІЛЮ ROBLOX
    $userinfo_url = 'https://apis.roblox.com/oauth/v1/userinfo';
    $ch2 = curl_init($userinfo_url);
    curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch2, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $access_token]);

    $userinfo_response = curl_exec($ch2);
    $userinfo_error = curl_error($ch2);
    curl_close($ch2);

    if ($userinfo_error) {
        throw new Exception('cURL помилка (профіль): ' . $userinfo_error);
    }

    $roblox_user = json_decode($userinfo_response, true);

    if (!isset($roblox_user['sub'])) {
        echo json_encode(['success' => false, 'message' => 'Немає даних акаунта', 'details' => $roblox_user]);
        exit;
    }

    // ВІДПРАВЛЯЄМО УСПІШНИЙ РЕЗУЛЬТАТ
    echo json_encode(['success' => true, 'data' => $roblox_user]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'Критична помилка PHP: ' . $e->getMessage(),
        'line' => $e->getLine()
    ]);
}
?>