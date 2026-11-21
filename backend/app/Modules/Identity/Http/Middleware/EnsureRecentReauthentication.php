<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Middleware;

use App\Modules\Identity\Enums\ErrorCode;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureRecentReauthentication
{
    public const CLE_2FA = 'auth.reauthenticated_at';

    public const CLE_MOT_DE_PASSE = 'auth.password_confirmed_at';

    public const CLE_METHODE_2FA = 'auth.reauthenticated_method';

    public const METHODE_TOTP = 'totp';

    public const METHODE_SECOURS = 'recovery_code';

    public const VARIANTE_DEUX_FACTEURS = 'two-factor';

    /**
     * `reauthenticated:two-factor` n'accepte qu'une preuve par code 2FA ou de secours : le mot de passe ne suffit jamais (ADR 0032).
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, ?string $variante = null): Response
    {
        $recente = match ($variante) {
            null => self::isRecent($request),
            self::VARIANTE_DEUX_FACTEURS => self::confirmedRecently($request, self::CLE_2FA),
            default => throw new \InvalidArgumentException('Variante de reauthenticated inconnue.'),
        };

        if (! $recente) {
            throw ErrorCode::ReauthenticationRequired->problem();
        }

        return $next($request);
    }

    public static function isRecent(Request $request): bool
    {
        return self::confirmedRecently($request, self::CLE_2FA) || self::confirmedRecently($request, self::CLE_MOT_DE_PASSE);
    }

    public static function confirmedRecently(Request $request, string $cle): bool
    {
        $limite = now()->subMinutes(self::fenetreMinutes())->getTimestamp();

        return $request->hasSession() && (int) $request->session()->get($cle, 0) >= $limite;
    }

    public static function confirmedUntil(Request $request, string $cle): ?CarbonImmutable
    {
        if (! self::confirmedRecently($request, $cle)) {
            return null;
        }

        return CarbonImmutable::createFromTimestamp((int) $request->session()->get($cle))->addMinutes(self::fenetreMinutes());
    }

    private static function fenetreMinutes(): int
    {
        $minutes = config('identity.reauthentication_minutes');

        return is_int($minutes) ? $minutes : 10;
    }
}
