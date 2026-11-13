<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Middleware;

use App\Modules\Identity\Enums\ErrorCode;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureRecentReauthentication
{
    public const CLE_2FA = 'auth.reauthenticated_at';

    public const CLE_MOT_DE_PASSE = 'auth.password_confirmed_at';

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! self::isRecent($request)) {
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
        $minutes = config('identity.reauthentication_minutes');
        $limite = now()->subMinutes(is_int($minutes) ? $minutes : 10)->getTimestamp();

        return $request->hasSession() && (int) $request->session()->get($cle, 0) >= $limite;
    }
}
