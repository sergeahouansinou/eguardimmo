<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Middleware;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\Space;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\ProfileRegistry;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final readonly class EnsureSpace
{
    public function __construct(private ProfileRegistry $profils) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string $espace): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        if ($user->email_verified_at === null) {
            throw ErrorCode::EmailUnverified->problem();
        }

        $cible = Space::from($espace);

        if ($cible !== Space::Operator && RefuseOperatorToken::porteLaCapaciteOperateur($user)) {
            throw ErrorCode::OperatorTokenForbidden->problem();
        }

        $autorise = $cible === Space::Operator
            ? RefuseOperatorToken::porteLaCapaciteOperateur($user) && $user->isActiveOperator() && $user->hasConfirmedTwoFactor()
            : $this->profils->has($user->id, $cible);

        if (! $autorise) {
            throw ($cible === Space::Operator ? ErrorCode::OperatorTokenRequired : ErrorCode::SpaceForbidden)->problem();
        }

        return $next($request);
    }
}
