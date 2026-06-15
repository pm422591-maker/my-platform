<?php
// security_lib.php — спільні функції для безпеки акаунта
// (підключення БД, надсилання пошти, геолокація IP, парсинг пристрою, трекінг сесій)

if (!function_exists('sec_pdo')) {
    function sec_pdo(): PDO {
        $host = getenv('DB_HOST') ?: 'my-mysql';
        $db   = getenv('DB_NAME') ?: 'mywebsite';
        $user = getenv('DB_USER') ?: 'appuser';
        $pass = getenv('DB_PASS') ?: '';
        $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
        ]);
        return $pdo;
    }
}

// ── Створення всіх потрібних таблиць/колонок (виконується безпечно, IF NOT EXISTS)
if (!function_exists('sec_ensure_schema')) {
    function sec_ensure_schema(PDO $pdo): void {
        // Токени підтвердження зміни пароля
        $pdo->exec("CREATE TABLE IF NOT EXISTS password_change_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token CHAR(64) NOT NULL,
            pending_hash VARCHAR(255) DEFAULT NULL,
            expires_at DATETIME NOT NULL,
            used TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX(token), INDEX(user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // Активні сесії пристроїв
        $pdo->exec("CREATE TABLE IF NOT EXISTS user_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            session_token CHAR(64) NOT NULL,
            ip VARCHAR(45) DEFAULT NULL,
            city VARCHAR(100) DEFAULT NULL,
            country VARCHAR(100) DEFAULT NULL,
            os VARCHAR(60) DEFAULT NULL,
            browser VARCHAR(60) DEFAULT NULL,
            user_agent VARCHAR(400) DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_active DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_token (session_token),
            INDEX(user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // 2FA: 4-значний PIN (зберігаємо хеш, не самі цифри)
        foreach ([
            "ALTER TABLE users ADD COLUMN two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0",
            "ALTER TABLE users ADD COLUMN two_factor_pin VARCHAR(255) DEFAULT NULL"
        ] as $sql) {
            try { $pdo->exec($sql); } catch (Exception $e) { /* колонка вже існує */ }
        }
    }
}

// ── Надсилання листа через SMTP (Gmail). Повертає текст помилки у $errOut.
require_once __DIR__ . '/smtp_config.php';
require_once __DIR__ . '/smtp_mailer.php';

if (!function_exists('sec_send_mail')) {
    function sec_send_mail(string $to, string $subject, string $htmlBody, ?string &$errOut = null): bool {
        $res = smtp_send_mail($to, '', $subject, $htmlBody);
        $errOut = $res['error'] ?? '';
        return $res['ok'] === true;
    }
}

// ── Реальний IP користувача (з урахуванням проксі)
if (!function_exists('sec_client_ip')) {
    function sec_client_ip(): string {
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
            if (!empty($_SERVER[$key])) {
                $ip = trim(explode(',', $_SERVER[$key])[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
            }
        }
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}

// ── Геолокація IP -> місто/країна (безкоштовний ip-api.com)
if (!function_exists('sec_geo_lookup')) {
    function sec_geo_lookup(string $ip): array {
        $result = ['city' => null, 'country' => null];
        // Локальні/приватні адреси не геолокуємо
        if ($ip === '0.0.0.0' || !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return $result;
        }
        try {
            if (function_exists('curl_init')) {
                $ch = curl_init("http://ip-api.com/json/{$ip}?fields=status,city,country&lang=uk");
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 4);
                $resp = curl_exec($ch);
                curl_close($ch);
            } else {
                $resp = @file_get_contents("http://ip-api.com/json/{$ip}?fields=status,city,country&lang=uk");
            }
            if ($resp) {
                $data = json_decode($resp, true);
                if (($data['status'] ?? '') === 'success') {
                    $result['city']    = $data['city'] ?? null;
                    $result['country'] = $data['country'] ?? null;
                }
            }
        } catch (Exception $e) { /* мовчки */ }
        return $result;
    }
}

// ── Визначення ОС та браузера з User-Agent
if (!function_exists('sec_parse_ua')) {
    function sec_parse_ua(string $ua): array {
        $os = 'Невідомо';
        if (preg_match('/Windows NT 10/i', $ua)) $os = 'Windows';
        elseif (preg_match('/Windows/i', $ua)) $os = 'Windows';
        elseif (preg_match('/iPhone|iPad|iPod/i', $ua)) $os = 'iOS';
        elseif (preg_match('/Android/i', $ua)) $os = 'Android';
        elseif (preg_match('/Mac OS X/i', $ua)) $os = 'macOS';
        elseif (preg_match('/Linux/i', $ua)) $os = 'Linux';

        $browser = 'Невідомо';
        if (preg_match('/Edg/i', $ua)) $browser = 'Edge';
        elseif (preg_match('/OPR|Opera/i', $ua)) $browser = 'Opera';
        elseif (preg_match('/Chrome/i', $ua)) $browser = 'Chrome';
        elseif (preg_match('/Firefox/i', $ua)) $browser = 'Firefox';
        elseif (preg_match('/Safari/i', $ua)) $browser = 'Safari';

        return ['os' => $os, 'browser' => $browser];
    }
}

// ── Реєстрація/оновлення поточної сесії пристрою
//    Викликається при кожному завантаженні даних користувача.
if (!function_exists('sec_track_session')) {
    function sec_track_session(PDO $pdo, int $userId): void {
        if (empty($_SESSION['device_token'])) {
            $_SESSION['device_token'] = bin2hex(random_bytes(32));
        }
        $token = $_SESSION['device_token'];
        $ua    = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 400);
        $ip    = sec_client_ip();

        // Чи існує сесія вже?
        $stmt = $pdo->prepare("SELECT id FROM user_sessions WHERE session_token = ?");
        $stmt->execute([$token]);
        $exists = $stmt->fetch();

        if ($exists) {
            $pdo->prepare("UPDATE user_sessions SET last_active = NOW(), ip = ? WHERE session_token = ?")
                ->execute([$ip, $token]);
        } else {
            $parsed = sec_parse_ua($ua);
            $geo    = sec_geo_lookup($ip);
            $stmt = $pdo->prepare("INSERT INTO user_sessions
                (user_id, session_token, ip, city, country, os, browser, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $userId, $token, $ip, $geo['city'], $geo['country'],
                $parsed['os'], $parsed['browser'], $ua
            ]);
        }
    }
}