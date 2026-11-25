<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

final class SebookRelay
{
    public const ENTETE_CLE = 'X-Sebook-Relay-Key';

    public const ENTETE_IP_CLIENT = 'X-Sebook-Client-Ip';

    public const LONGUEUR_MINIMALE_CLE = 32;

    public const LIMITE_VISITEUR_PAR_MINUTE = 60;

    // Lectures du serveur sans visiteur : le plan du site en fait jusqu'à 80 d'affilée.
    public const LIMITE_SERVEUR_PAR_MINUTE = 120;

    public const MESSAGE_CLE_REFUSEE = 'Relais SeBook : clé refusée. SEBOOK_RELAY_KEY doit être identique côté API et côté SeBook (32 caractères au moins).';

    private const ROUTES = ['listings.index', 'listings.show'];

    public static function limite(Request $request): ?Limit
    {
        if (! $request->routeIs(...self::ROUTES) || ! self::cleAcceptee($request)) {
            return null;
        }

        $ip = $request->header(self::ENTETE_IP_CLIENT);

        return is_string($ip) && filter_var($ip, FILTER_VALIDATE_IP) !== false
            ? Limit::perMinute(self::LIMITE_VISITEUR_PAR_MINUTE)->by('sebook:'.RateLimitIp::cle($ip))
            : Limit::perMinute(self::LIMITE_SERVEUR_PAR_MINUTE)->by('sebook-serveur');
    }

    private static function cleAcceptee(Request $request): bool
    {
        $presentee = $request->header(self::ENTETE_CLE);

        // Le proxy peut transmettre l'en-tête vide aux requêtes extérieures : ce n'est pas une clé refusée.
        if (! is_string($presentee) || $presentee === '') {
            return false;
        }

        $cle = config('marketplace.sebook_relay_key');

        if (is_string($cle) && strlen($cle) >= self::LONGUEUR_MINIMALE_CLE && hash_equals($cle, $presentee)) {
            return true;
        }

        if (Cache::add('sebook-relais:cle-refusee', true, 60)) {
            Log::warning(self::MESSAGE_CLE_REFUSEE);
        }

        return false;
    }
}
