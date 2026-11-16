<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Illuminate\Http\Request;

final class ConsoleRelay
{
    public const ENTETE_CLE = 'X-Console-Relay-Key';

    public const ENTETE_IP_CLIENT = 'X-Console-Client-Ip';

    public const LONGUEUR_MINIMALE_CLE = 32;

    public static function ipRelayee(Request $request): ?string
    {
        $cle = config('identity.console_relay_key');
        $presentee = $request->header(self::ENTETE_CLE);
        $ip = $request->header(self::ENTETE_IP_CLIENT);

        if (! is_string($cle) || strlen($cle) < self::LONGUEUR_MINIMALE_CLE || ! is_string($presentee) || ! hash_equals($cle, $presentee)) {
            return null;
        }

        return is_string($ip) && filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : null;
    }

    public static function ipClient(Request $request): ?string
    {
        return self::ipRelayee($request) ?? $request->ip();
    }
}
