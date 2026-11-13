<?php

declare(strict_types=1);

namespace App\Modules\Identity\Support;

final class Hub
{
    private const LONGUEUR_MAX = 2048;

    public static function url(string $chemin = '/'): string
    {
        $base = config('identity.hub_url');

        return (is_string($base) ? rtrim($base, '/') : '').'/'.ltrim($chemin, '/');
    }

    public static function safeReturnTo(?string $url): string
    {
        return $url !== null && self::isAllowedReturnTo($url) ? $url : self::url();
    }

    public static function isAllowedReturnTo(string $url): bool
    {
        if ($url === '' || strlen($url) > self::LONGUEUR_MAX || str_starts_with($url, '//')) {
            return false;
        }

        if (preg_match('/[\x00-\x20\x7F\\\\]/', $url) === 1 || stripos($url, '%25') !== false) {
            return false;
        }

        $parties = parse_url($url);

        if ($parties === false || isset($parties['user']) || isset($parties['pass']) || ! isset($parties['scheme'], $parties['host'])) {
            return false;
        }

        $schemas = app()->environment('local') ? ['https', 'http'] : ['https'];

        if (! in_array(strtolower($parties['scheme']), $schemas, true)) {
            return false;
        }

        $hote = strtolower($parties['host']).(isset($parties['port']) ? ':'.$parties['port'] : '');

        return in_array($hote, self::allowedHosts(), true);
    }

    /**
     * @return list<string>
     */
    private static function allowedHosts(): array
    {
        $hotes = config('identity.return_to_allowed_hosts');

        return is_array($hotes) ? array_values(array_map(strtolower(...), array_filter($hotes, is_string(...)))) : [];
    }
}
