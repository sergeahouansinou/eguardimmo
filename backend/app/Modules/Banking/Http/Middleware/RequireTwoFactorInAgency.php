<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Middleware;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Double authentification exigée dans une agence pour importer et pointer (ADR 0035 § 10) ; un bailleur autonome n'y est pas tenu.
 * À placer après le middleware `organization`.
 */
final readonly class RequireTwoFactorInAgency
{
    public function __construct(private MembershipDirectory $adhesions, private CurrentOrganization $contexte) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $utilisateur = $request->user();

        if (! $utilisateur instanceof User) {
            throw new AuthenticationException;
        }

        $adhesion = $this->adhesions->activeMembership((string) $utilisateur->getKey(), $this->contexte->id());

        if ($adhesion?->kind === OrganizationKind::Agency && ! $utilisateur->hasConfirmedTwoFactor()) {
            throw ErrorCode::TwoFactorRequired->problem();
        }

        return $next($request);
    }
}
