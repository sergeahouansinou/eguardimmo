<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Illuminate\Http\Request;

final class RateLimitIp
{
    private const PREFIXE_IPV4_MAPPEE = "\0\0\0\0\0\0\0\0\0\0\xff\xff";

    public static function of(Request $request): string
    {
        return self::cle((string) $request->ip());
    }

    public static function cle(string $ip): string
    {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) === false) {
            return $ip;
        }

        $octets = (string) inet_pton($ip);

        // Le /64 d'une IPv4 mappée est nul : sans ce cas, tous ces clients partageraient le même seau.
        if (str_starts_with($octets, self::PREFIXE_IPV4_MAPPEE)) {
            return (string) inet_ntop(substr($octets, 12));
        }

        return inet_ntop(substr($octets, 0, 8).str_repeat("\0", 8)).'/64';
    }
}
