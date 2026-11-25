<?php

declare(strict_types=1);

namespace App\Providers;

use App\Shared\Http\ConsoleRelay;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

/**
 * Limitation de débit et proxies de confiance (docs/adr/0002).
 */
final class HttpSecurityServiceProvider extends ServiceProvider
{
    public const LIMITE_UTILISATEUR_PAR_MINUTE = 300;

    public const LIMITE_ANONYME_PAR_MINUTE = 60;

    public const LIMITE_AUTH_PAR_COMPTE_PAR_MINUTE = 5;

    public const LIMITE_AUTH_PAR_IP_PAR_MINUTE = 20;

    public const LIMITE_DEUX_FACTEURS_PAR_MINUTE = 5;

    public const LIMITE_REAUTHENTIFICATION_PAR_MINUTE = 5;

    public function boot(): void
    {
        $this->configurerProxies();
        $this->configurerLimites();
    }

    private function configurerProxies(): void
    {
        $proxies = config('app.trusted_proxies');

        if (is_array($proxies) && $proxies !== []) {
            TrustProxies::at(array_values(array_filter($proxies, is_string(...))));
        }
    }

    private function configurerLimites(): void
    {
        // Le throttle du groupe api passe avant auth:sanctum : il faut résoudre l'utilisateur via le guard sanctum.
        RateLimiter::for('api', function (Request $request): Limit {
            $identifiant = $request->user('sanctum')?->getAuthIdentifier();

            return is_int($identifiant) || is_string($identifiant)
                ? Limit::perMinute(self::LIMITE_UTILISATEUR_PAR_MINUTE)->by('user:'.$identifiant)
                : Limit::perMinute(self::LIMITE_ANONYME_PAR_MINUTE)->by('ip:'.self::ipCliente($request));
        });

        RateLimiter::for('auth', function (Request $request): array {
            $email = Str::lower(trim((string) $request->string('email')));

            return [
                Limit::perMinute(self::LIMITE_AUTH_PAR_COMPTE_PAR_MINUTE)->by('auth-compte:'.$email.'|'.self::ipCliente($request)),
                Limit::perMinute(self::LIMITE_AUTH_PAR_IP_PAR_MINUTE)->by('auth-ip:'.self::ipCliente($request)),
            ];
        });

        // Opération sensible d'un compte connecté (suppression) : la clé est le compte, pas l'IP partagée d'un CGNAT.
        RateLimiter::for('reauth', function (Request $request): Limit {
            $identifiant = $request->user()?->getAuthIdentifier();

            return Limit::perMinute(self::LIMITE_REAUTHENTIFICATION_PAR_MINUTE)
                ->by(is_string($identifiant) ? 'reauth:'.$identifiant : 'reauth-ip:'.$request->ip());
        });

        // Le défi 2FA web n'envoie pas d'e-mail : la clé est le compte en attente, pas l'IP partagée derrière un NAT.
        RateLimiter::for('two-factor', function (Request $request): array {
            $enAttente = $request->hasSession() ? $request->session()->get('login.id') : null;

            return [
                Limit::perMinute(self::LIMITE_DEUX_FACTEURS_PAR_MINUTE)->by('two-factor:'.(is_scalar($enAttente) ? (string) $enAttente : 'ip:'.$request->ip())),
                Limit::perMinute(self::LIMITE_AUTH_PAR_IP_PAR_MINUTE)->by('two-factor-ip:'.$request->ip()),
            ];
        });
    }

    // Derrière la console, toutes les connexions partagent l'IP de son serveur : sans l'IP relayée, un attaquant bloquerait tous les opérateurs.
    public static function ipCliente(Request $request): string
    {
        $relayee = ConsoleRelay::ipRelayee($request);

        return $relayee !== null ? 'console:'.$relayee : (string) $request->ip();
    }
}
