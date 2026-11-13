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
        $minutes = config('identity.reauthentication_minutes');
        $limite = now()->subMinutes(is_int($minutes) ? $minutes : 10)->getTimestamp();

        $recente = $request->hasSession() && collect([self::CLE_2FA, self::CLE_MOT_DE_PASSE])
            ->contains(fn (string $cle): bool => (int) $request->session()->get($cle, 0) >= $limite);

        if (! $recente) {
            throw ErrorCode::ReauthenticationRequired->problem();
        }

        return $next($request);
    }
}
