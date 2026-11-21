<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Middleware;

use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Jurisdictions\OwnerFundsJurisdictions;
use App\Shared\Tenancy\CurrentOrganization;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Les fonds des mandants sont une fonction d'agence dont la juridiction est prise en charge (ADR 0031) : le refus vient de
 * l'API. À placer après le middleware `organization`, qui pose le contexte et contrôle l'appartenance.
 */
final readonly class RequireAgencyOrganization
{
    public function __construct(
        private MembershipDirectory $adhesions,
        private CurrentOrganization $contexte,
        private OrganizationDirectory $organisations,
        private OwnerFundsJurisdictions $juridictions,
    ) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $utilisateur = $request->user();

        if ($utilisateur === null) {
            throw new AuthenticationException;
        }

        $adhesion = $this->adhesions->activeMembership((string) $utilisateur->getKey(), $this->contexte->id());

        if ($adhesion === null || $adhesion->kind !== OrganizationKind::Agency) {
            throw ErrorCode::AgencyOnly->problem();
        }

        $this->juridictions->for($this->organisations->country());

        return $next($request);
    }
}
