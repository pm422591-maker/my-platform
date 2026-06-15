<?php
// smtp_config.php — налаштування пошти.
//
// ⚠️ ВАЖЛИВО ДЛЯ GMAIL:
//    Тут потрібен НЕ звичайний пароль від пошти, а "Пароль додатка" (App Password) —
//    16 символів, які видає Google. Як отримати:
//    1) Увімкни двоетапну перевірку: https://myaccount.google.com/security
//    2) Відкрий: https://myaccount.google.com/apppasswords
//    3) Створи пароль (назва будь-яка, напр. "Syncora") і встав його нижче в SMTP_PASS.
//    Пробіли у паролі можна прибрати або залишити — код сам їх вичистить.

if (!function_exists('smtp_config')) {
    function smtp_config(): array {
        return [
            'host'       => 'smtp.gmail.com',
            'port'       => 587,
            'secure'     => 'tls',            // 587 = tls, 465 = ssl
            'user'       => 'syncora12@gmail.com',
            // ⬇️ ВСТАВ СЮДИ ПАРОЛЬ ДОДАТКА GMAIL (16 символів)
            'pass'       => str_replace(' ', '', 'PASTE_APP_PASSWORD_HERE'),
            'from_email' => 'syncora12@gmail.com',
            'from_name'  => 'Syncora',
        ];
    }
}