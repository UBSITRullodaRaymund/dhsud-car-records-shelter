<?php
declare(strict_types=1);

namespace App\Core;

final class GoogleSheetsBridge
{
    private const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbzB000NSx4wtVSrn-_tEJZ6AiIRLGQlTZrDvZNbULkSaf7LJDLM33nz7dXjsoDuXXGY/exec';

    public function request(string $method, array $parameters): array
    {
        $url = getenv('DHSUD_APPS_SCRIPT_URL') ?: self::DEFAULT_URL;
        if (!filter_var($url, FILTER_VALIDATE_URL)
            || !str_starts_with($url, 'https://script.google.com/macros/s/')) {
            throw new \RuntimeException('DHSUD_APPS_SCRIPT_URL must be an HTTPS Apps Script web-app URL.');
        }
        $action = $parameters['action'] ?? '';
        if (!is_string($action) || $action === '') {
            throw new \InvalidArgumentException('An Apps Script action is required.');
        }

        $handle = curl_init();
        if ($handle === false) {
            throw new \RuntimeException('Could not initialize the Apps Script connection.');
        }

        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 45,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ];

        if ($method === 'GET') {
            $options[CURLOPT_URL] = $url . '?' . http_build_query($parameters);
        } else {
            $options[CURLOPT_URL] = $url;
            $options[CURLOPT_POST] = true;
            $options[CURLOPT_POSTFIELDS] = http_build_query($parameters);
            $options[CURLOPT_HTTPHEADER][] = 'Content-Type: application/x-www-form-urlencoded';
        }

        curl_setopt_array($handle, $options);
        $body = curl_exec($handle);
        $error = curl_error($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);

        if ($body === false || $error !== '') {
            throw new \RuntimeException('Could not reach Google Apps Script: ' . ($error ?: 'unknown connection error'));
        }

        $result = json_decode($body, true);
        if (!is_array($result)) {
            throw new \RuntimeException('Google Apps Script returned an invalid response (HTTP ' . $status . ').');
        }

        return $result;
    }
}
