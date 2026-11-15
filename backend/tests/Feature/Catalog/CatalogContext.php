<?php

declare(strict_types=1);

namespace Tests\Feature\Catalog;

use App\Modules\Catalog\PublicApi\PlatformCatalog;
use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Shared\Tenancy\CurrentOrganization;
use Closure;

final class CatalogContext
{
    public static function organisation(): Organization
    {
        $titulaire = User::factory()->create();
        activerDeuxFacteurs($titulaire);

        return app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData(OrganizationKind::Agency, 'Agence du Port', 'FR'), 'Awa', 'Diallo');
    }

    public static function titulaire(Organization $organisation): User
    {
        return User::query()->findOrFail($organisation->created_by_user_id);
    }

    public static function gestionnaire(Organization $organisation): User
    {
        $compte = User::factory()->create();

        self::dans($organisation, fn (): OrganizationMember => OrganizationMember::query()->create([
            'user_id' => $compte->id,
            'email' => mb_strtolower($compte->email),
            'first_name' => 'Marc',
            'last_name' => 'Chevalier',
            'role' => MemberRole::Manager,
            'status' => MemberStatus::Active,
            'joined_at' => now(),
        ]));

        return $compte;
    }

    public static function semer(): void
    {
        app(PlatformCatalog::class)->seed();
    }

    /**
     * @template T
     *
     * @param  Closure(): T  $appel
     * @return T
     */
    public static function dans(Organization $organisation, Closure $appel): mixed
    {
        return app(CurrentOrganization::class)->run($organisation->id, $appel);
    }

    public static function changerDeCompte(mixed $test, User $compte): mixed
    {
        auth()->forgetGuards();
        app()->forgetInstance(CurrentOrganization::class);

        return $test->actingAs($compte);
    }

    public static function url(Organization $organisation, string $chemin): string
    {
        return "/api/v1/org/{$organisation->id}/catalog{$chemin}";
    }
}
