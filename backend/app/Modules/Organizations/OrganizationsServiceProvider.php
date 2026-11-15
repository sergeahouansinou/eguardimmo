<?php

declare(strict_types=1);

namespace App\Modules\Organizations;

use App\Modules\Identity\Data\ProfileData;
use App\Modules\Identity\Enums\Space;
use App\Modules\Identity\PublicApi\ProfileRegistry;
use App\Modules\Organizations\Data\MembershipData;
use App\Modules\Organizations\Http\Middleware\EnterOrganization;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Organizations\Queries\Memberships;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;

final class OrganizationsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Relation::enforceMorphMap([
            'organization' => Organization::class,
            'organization_member' => OrganizationMember::class,
        ]);

        /** @var Router $routeur */
        $routeur = $this->app->make(Router::class);
        $routeur->aliasMiddleware('organization', EnterOrganization::class);
        $this->app->make(HttpKernel::class)->addToMiddlewarePriorityBefore(SubstituteBindings::class, EnterOrganization::class);

        $this->app->make(ProfileRegistry::class)->register(
            fn (string $userId): array => array_map(
                fn (MembershipData $adhesion): ProfileData => new ProfileData(Space::Organization, $adhesion->organizationName, [
                    'organization' => $adhesion->organizationId,
                    'kind' => $adhesion->kind->value,
                    'role' => $adhesion->role->value,
                ]),
                $this->app->make(Memberships::class)->activeFor($userId),
            ),
        );
    }
}
