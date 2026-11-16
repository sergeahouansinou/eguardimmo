<?php

declare(strict_types=1);

namespace Tests\Feature\Leases;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\PublicApi\PlatformCatalog;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Models\Lease;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Property;
use App\Modules\Properties\Models\Unit;
use App\Shared\Tenancy\CurrentOrganization;
use Closure;

final class LeasesContext
{
    public static function semer(): void
    {
        app(PlatformCatalog::class)->seed();
    }

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

    public static function membre(Organization $organisation, MemberRole $role): User
    {
        $compte = User::factory()->create();

        self::dans($organisation, fn (): OrganizationMember => OrganizationMember::query()->create([
            'user_id' => $compte->id,
            'email' => mb_strtolower($compte->email),
            'first_name' => 'Marc',
            'last_name' => 'Chevalier',
            'role' => $role,
            'status' => MemberStatus::Active,
            'joined_at' => now(),
        ]));

        return $compte;
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

    public static function lot(Organization $organisation): Unit
    {
        return self::dans($organisation, fn (): Unit => Unit::factory()->create([
            'property_id' => Property::factory()->create()->id,
            'unit_type_term_id' => self::terme('unit_type', 'apartment')->id,
        ]));
    }

    public static function partie(Organization $organisation): Party
    {
        return self::dans($organisation, fn (): Party => Party::factory()->create());
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function bail(Organization $organisation, array $attributs = []): Lease
    {
        return self::dans($organisation, fn (): Lease => Lease::factory()->create($attributs));
    }

    public static function composante(string $cle = 'rent'): Term
    {
        return self::terme(VocabularyKey::LeaseComponent->value, $cle);
    }

    public static function terme(string $vocabulaire, string $cle): Term
    {
        return Term::query()->whereNull('organization_id')->where('vocabulary', $vocabulaire)->where('key', $cle)->firstOrFail();
    }
}
