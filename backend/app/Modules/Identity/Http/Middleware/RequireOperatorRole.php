<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Middleware;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Models\User;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * `operator:admin,support` : au moins un des rôles listés. `operator:any` : au moins un rôle. Un opérateur sans rôle n'a accès à rien.
 */
final class RequireOperatorRole
{
    public const TOUS = 'any';

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        $detenus = $user->operatorRoles();
        $requis = $roles === [self::TOUS] ? OperatorRole::cases() : array_map(OperatorRole::from(...), $roles);

        if (array_filter($detenus, fn (OperatorRole $role): bool => in_array($role, $requis, true)) === []) {
            throw ErrorCode::OperatorRoleRequired->problem();
        }

        return $next($request);
    }
}
