<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Middleware;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Queries\Memberships;
use App\Modules\Organizations\Support\OrganizationContext;
use App\Shared\Tenancy\CurrentOrganization;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final readonly class EnterOrganization
{
    public function __construct(
        private Memberships $adhesions,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        $route = $request->route();
        $identifiant = $route instanceof Route ? $route->parameter('organization') : null;

        if (! $route instanceof Route || ! is_string($identifiant) || ! Str::isUuid($identifiant)) {
            throw ErrorCode::OrganizationNotFound->problem();
        }

        $membre = $this->adhesions->activeMember($user->id, $identifiant);
        $organisation = $membre === null ? null : Organization::query()->find($identifiant);

        if ($membre === null || $organisation === null) {
            throw ErrorCode::OrganizationNotFound->problem();
        }

        $deuxFacteursExige = $organisation->two_factor_required
            || ($organisation->kind === OrganizationKind::Agency && $membre->role->managesTeam());

        if ($deuxFacteursExige && ! $user->hasConfirmedTwoFactor()) {
            throw ErrorCode::TwoFactorRequired->problem();
        }

        if ($roles !== [] && ! in_array($membre->role, array_map(MemberRole::from(...), $roles), true)) {
            throw ErrorCode::RoleForbidden->problem();
        }

        $this->contexte->set($organisation->id);
        OrganizationContext::store($request, $organisation, $membre);
        $route->forgetParameter('organization');

        return $next($request);
    }
}
