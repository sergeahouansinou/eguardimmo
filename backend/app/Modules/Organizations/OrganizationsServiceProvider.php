<?php

declare(strict_types=1);

namespace App\Modules\Organizations;

use App\Modules\Identity\Data\ProfileData;
use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Enums\Space;
use App\Modules\Identity\PublicApi\ProfileRegistry;
use App\Modules\Organizations\Console\ReportScopedMembersCommand;
use App\Modules\Organizations\Data\MembershipData;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Http\Middleware\EnterOrganization;
use App\Modules\Organizations\Http\Middleware\RequireConfirmedTwoFactor;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationLegalIdentity;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Organizations\Queries\Memberships;
use App\Modules\Organizations\Queries\PlatformAudiences;
use App\Modules\Organizations\Queries\ReminderTargets;
use App\Modules\Organizations\Support\OrganizationApprovalHandlers;
use App\Shared\Approval\ApprovalHandlers;
use App\Shared\Audience\AudienceRegistry;
use App\Shared\Reminders\ReminderRegistry;
use App\Shared\Reminders\ReminderWindow;
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
            'organization_legal_identity' => OrganizationLegalIdentity::class,
        ]);

        /** @var Router $routeur */
        $routeur = $this->app->make(Router::class);
        $routeur->aliasMiddleware('organization', EnterOrganization::class);
        $routeur->aliasMiddleware('two-factor', RequireConfirmedTwoFactor::class);
        $noyau = $this->app->make(HttpKernel::class);
        $noyau->addToMiddlewarePriorityBefore(SubstituteBindings::class, EnterOrganization::class);
        $noyau->addToMiddlewarePriorityAfter(EnterOrganization::class, RequireConfirmedTwoFactor::class);

        $this->app->make(OrganizationApprovalHandlers::class)->register($this->app->make(ApprovalHandlers::class));
        $this->enregistrerDestinatairesPlateforme();

        if ($this->app->runningInConsole()) {
            $this->commands([ReportScopedMembersCommand::class]);
        }

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

    private function enregistrerDestinatairesPlateforme(): void
    {
        $groupes = $this->app->make(AudienceRegistry::class);
        $groupes->register('agency_members', fn (): iterable => $this->app->make(PlatformAudiences::class)->members(OrganizationKind::Agency));
        $groupes->register('individual_landlords', fn (): iterable => $this->app->make(PlatformAudiences::class)->members(OrganizationKind::Individual));

        $rappels = $this->app->make(ReminderRegistry::class);
        $rappels->register('agency_not_created', fn (ReminderWindow $fenetre): iterable => $this->app->make(ReminderTargets::class)
            ->accountsWithout(IntendedProfile::Agency, OrganizationKind::Agency, $fenetre));
        $rappels->register('landlord_space_not_created', fn (ReminderWindow $fenetre): iterable => $this->app->make(ReminderTargets::class)
            ->accountsWithout(IntendedProfile::IndividualLandlord, OrganizationKind::Individual, $fenetre));
        $rappels->resolveOrganizations(fn (ReminderWindow $fenetre): iterable => $this->app->make(ReminderTargets::class)->created($fenetre));
        $rappels->resolveSuspendedOrganizations(fn (): array => $this->app->make(ReminderTargets::class)->suspendedIds());
    }
}
