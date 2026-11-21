<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Messaging\Http\Resources\Console\OrganizationTeamResource;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Lecture sous `support-access:team` : l'équipe active de l'organisation de la route.
 */
final class OrganizationTeamController
{
    public function __invoke(string $organization, CurrentOrganization $contexte, MembershipDirectory $adhesions): AnonymousResourceCollection
    {
        return OrganizationTeamResource::collection($contexte->run(strtolower($organization), fn (): array => $adhesions->activeTeam()));
    }
}
