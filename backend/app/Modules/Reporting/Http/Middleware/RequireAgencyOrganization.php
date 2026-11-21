<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Middleware;

use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Jurisdictions\ManagementReportJurisdictions;
use App\Shared\Tenancy\CurrentOrganization;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tableaux de bord et comptes rendus sont une fonction d'agence (ADR 0030) ; avec `:jurisdiction`, la juridiction du siège doit
 * aussi avoir des règles de compte rendu. À placer après le middleware `organization`, qui pose le contexte.
 */
final readonly class RequireAgencyOrganization
{
    public function __construct(
        private MembershipDirectory $adhesions,
        private CurrentOrganization $contexte,
        private OrganizationDirectory $organisations,
        private ManagementReportJurisdictions $juridictions,
    ) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string ...$options): Response
    {
        $utilisateur = $request->user();

        if ($utilisateur === null) {
            throw new AuthenticationException;
        }

        $adhesion = $this->adhesions->activeMembership((string) $utilisateur->getKey(), $this->contexte->id());

        if ($adhesion === null || $adhesion->kind !== OrganizationKind::Agency) {
            throw ErrorCode::AgencyOnly->problem();
        }

        if (in_array('jurisdiction', $options, true)) {
            $this->juridictions->for($this->organisations->country());
        }

        return $next($request);
    }
}
