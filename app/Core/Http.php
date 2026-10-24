<?php
declare(strict_types=1);

namespace App\Core;

final class Http
{
    public static function json(array $body, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        exit;
    }

    public static function input(string $key, string $default = ''): string
    {
        $value = $_POST[$key] ?? $_GET[$key] ?? $default;
        return is_scalar($value) ? trim((string) $value) : $default;
    }

    public static function requireCsrf(): void
    {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        $expected = $_SESSION['csrf_token'] ?? '';

        if (!is_string($token) || !is_string($expected) || $expected === '' || !hash_equals($expected, $token)) {
            self::json(['error' => 'Invalid or missing CSRF token.'], 419);
        }
    }
}
