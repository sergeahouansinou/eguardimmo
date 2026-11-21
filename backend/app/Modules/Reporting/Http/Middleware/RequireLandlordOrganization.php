<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Middleware;

use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Modules\Reporting\Enums\ErrorCode;
use App\Shared\Tenancy\CurrentOrganization;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Rentabilité, prévisionnel et leurs exports : organisation `individual` seulement (ADR 0039). À placer après le middleware `organization`.
 */
final readonly class RequireLandlordOrganization
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

        if ($adhesion === null || $adhesion->kind !== OrganizationKind::Individual) {
            throw ErrorCode::LandlordOnly->problem();
        }

        return $next($request);
    }
}
