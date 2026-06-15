<?php
// smtp_mailer.php — надсилання пошти напряму через SMTP-сокет.
// Без Composer / PHPMailer. Працює з Gmail (та будь-яким SMTP).

if (!function_exists('smtp_send_mail')) {
    /**
     * @return array{ok:bool, error:string}
     */
    function smtp_send_mail(string $toEmail, string $toName, string $subject, string $htmlBody): array {
        $cfg = smtp_config();

        $host   = $cfg['host'];
        $port   = (int)$cfg['port'];
        $user   = $cfg['user'];
        $pass   = $cfg['pass'];
        $fromEmail = $cfg['from_email'];
        $fromName  = $cfg['from_name'];
        $secure = $cfg['secure']; // 'tls' | 'ssl'

        if ($user === '' || $pass === '' || strpos($pass, 'PASTE_') === 0) {
            return ['ok' => false, 'error' => 'SMTP не налаштовано (порожній логін або пароль у smtp_config.php).'];
        }

        $remote = ($secure === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
        $ctx = stream_context_create([
            'ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true]
        ]);

        $errno = 0; $errstr = '';
        $fp = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
        if (!$fp) {
            return ['ok' => false, 'error' => "Не вдалося підключитись до SMTP ($host:$port): $errstr"];
        }
        stream_set_timeout($fp, 15);

        $read = function () use ($fp) {
            $data = '';
            while ($line = fgets($fp, 515)) {
                $data .= $line;
                // 4-й символ '-' = продовження багаторядкової відповіді
                if (isset($line[3]) && $line[3] === ' ') break;
            }
            return $data;
        };
        $write = function ($cmd) use ($fp) { fwrite($fp, $cmd . "\r\n"); };
        $code  = function ($resp) { return (int)substr(trim($resp), 0, 3); };

        $greet = $read();
        if ($code($greet) !== 220) { fclose($fp); return ['ok' => false, 'error' => 'SMTP не привітався: ' . trim($greet)]; }

        $ehloHost = $_SERVER['HTTP_HOST'] ?? 'syncora.cyou';
        $write("EHLO $ehloHost"); $resp = $read();
        if ($code($resp) !== 250) { fclose($fp); return ['ok' => false, 'error' => 'EHLO відхилено: ' . trim($resp)]; }

        // STARTTLS для порту 587
        if ($secure === 'tls') {
            $write("STARTTLS"); $resp = $read();
            if ($code($resp) !== 220) { fclose($fp); return ['ok' => false, 'error' => 'STARTTLS відхилено: ' . trim($resp)]; }
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT)) {
                fclose($fp); return ['ok' => false, 'error' => 'Не вдалося увімкнути TLS.'];
            }
            $write("EHLO $ehloHost"); $resp = $read();
            if ($code($resp) !== 250) { fclose($fp); return ['ok' => false, 'error' => 'EHLO після TLS відхилено: ' . trim($resp)]; }
        }

        // Авторизація LOGIN
        $write("AUTH LOGIN"); $resp = $read();
        if ($code($resp) !== 334) { fclose($fp); return ['ok' => false, 'error' => 'AUTH LOGIN не підтримується: ' . trim($resp)]; }
        $write(base64_encode($user)); $resp = $read();
        if ($code($resp) !== 334) { fclose($fp); return ['ok' => false, 'error' => 'Логін відхилено: ' . trim($resp)]; }
        $write(base64_encode($pass)); $resp = $read();
        if ($code($resp) !== 235) {
            fclose($fp);
            return ['ok' => false, 'error' => 'Авторизація не пройшла. Для Gmail потрібен ПАРОЛЬ ДОДАТКА (App Password), не звичайний пароль. Відповідь: ' . trim($resp)];
        }

        // Конверт
        $write("MAIL FROM:<$fromEmail>"); $resp = $read();
        if ($code($resp) !== 250) { fclose($fp); return ['ok' => false, 'error' => 'MAIL FROM відхилено: ' . trim($resp)]; }
        $write("RCPT TO:<$toEmail>"); $resp = $read();
        if ($code($resp) !== 250 && $code($resp) !== 251) { fclose($fp); return ['ok' => false, 'error' => 'RCPT TO відхилено: ' . trim($resp)]; }

        $write("DATA"); $resp = $read();
        if ($code($resp) !== 354) { fclose($fp); return ['ok' => false, 'error' => 'DATA відхилено: ' . trim($resp)]; }

        // Заголовки + тіло
        $encSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $encFromNm  = '=?UTF-8?B?' . base64_encode($fromName) . '?=';
        $encToNm    = $toName ? '=?UTF-8?B?' . base64_encode($toName) . '?= ' : '';
        $date = date('r');

        $headers  = "Date: $date\r\n";
        $headers .= "From: $encFromNm <$fromEmail>\r\n";
        $headers .= "To: {$encToNm}<$toEmail>\r\n";
        $headers .= "Subject: $encSubject\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        $headers .= "Content-Transfer-Encoding: base64\r\n";

        // Тіло base64 (рядки до 76 символів)
        $body = chunk_split(base64_encode($htmlBody));

        // Крапки на початку рядків екранувати (dot-stuffing)
        $message = $headers . "\r\n" . $body;
        $message = preg_replace('/^\./m', '..', $message);

        $write($message . "\r\n.");
        $resp = $read();
        if ($code($resp) !== 250) { fclose($fp); return ['ok' => false, 'error' => 'Лист не прийнято сервером: ' . trim($resp)]; }

        $write("QUIT");
        fclose($fp);

        return ['ok' => true, 'error' => ''];
    }
}