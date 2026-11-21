<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Middleware;

use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Modules\Tax\Enums\ErrorCode;
use App\Shared\Tenancy\CurrentOrganization;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Relevés fiscaux des mandants : organisation `agency` seulement. À placer après le middleware `organization`.
 */
final readonly class RequireAgencyOrganization
{
    public function __construct(private MembershipDirectory $adhesions, private CurrentOrganization $contexte) {}

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

        return $next($request);
    }
}
