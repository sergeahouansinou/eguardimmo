<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Middleware;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\User;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Actions du voyageur sur SeBook : compte authentifié, e-mail vérifié, compte non suspendu. Sans cela `verified` répondrait un `forbidden` générique,
 * alors que les clients se branchent sur `email_unverified`.
 */
final class EnsureTraveler
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        if ($user->email_verified_at === null) {
            throw ErrorCode::EmailUnverified->problem();
        }

        if ($user->isSuspended()) {
            throw ErrorCode::AccountSuspended->problem();
        }

        return $next($request);
    }
}
