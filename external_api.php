<?php
declare(strict_types=1);

function api_http_get(string $url, array $headers = [], int $timeout = 12): array
{
    $defaultHeaders = [
        'User-Agent: GamerProfile/1.0',
        'Accept: application/json',
    ];
    $headers = array_merge($defaultHeaders, $headers);

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => min(5, $timeout),
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        $body = curl_exec($ch);
        $error = curl_error($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return [
            'ok' => $body !== false && $error === '',
            'status' => $status,
            'body' => $body === false ? '' : (string)$body,
            'error' => $error,
        ];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => implode("\r\n", $headers),
            'timeout' => $timeout,
            'ignore_errors' => true,
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    $status = 0;

    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $headerLine) {
            if (preg_match('/^HTTP\/\S+\s+(\d+)/', $headerLine, $matches)) {
                $status = (int)$matches[1];
                break;
            }
        }
    }

    return [
        'ok' => $body !== false,
        'status' => $status,
        'body' => $body === false ? '' : (string)$body,
        'error' => $body === false ? 'file_get_contents failed' : '',
    ];
}

function api_http_get_json(string $url, array $headers = [], int $timeout = 12): array
{
    $response = api_http_get($url, $headers, $timeout);

    if (!$response['ok']) {
        return [
            'success' => false,
            'status' => $response['status'],
            'message' => $response['error'] ?: 'Request failed',
            'data' => null,
        ];
    }

    if ($response['status'] < 200 || $response['status'] >= 300) {
        return [
            'success' => false,
            'status' => $response['status'],
            'message' => 'Remote API returned HTTP ' . $response['status'],
            'data' => json_decode($response['body'], true),
        ];
    }

    $decoded = json_decode($response['body'], true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return [
            'success' => false,
            'status' => $response['status'],
            'message' => 'Invalid JSON: ' . json_last_error_msg(),
            'data' => null,
        ];
    }

    return [
        'success' => true,
        'status' => $response['status'],
        'message' => '',
        'data' => $decoded,
    ];
}