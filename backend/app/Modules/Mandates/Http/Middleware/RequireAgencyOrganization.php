<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Middleware;

use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Les mandats sont une fonction d'agence (ADR 0006) : le refus vient de l'API, pas seulement de l'interface.
 * À placer après le middleware `organization`, qui pose le contexte et contrôle l'appartenance.
 */
final readonly class RequireAgencyOrganization
{
    public function __construct(
        private MembershipDirectory $adhesions,
        private CurrentOrganization $contexte,
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
            throw ErrorCode::MandateAgencyOnly->problem();
        }

        return $next($request);
    }
}
