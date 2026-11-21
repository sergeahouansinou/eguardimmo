<?php

declare(strict_types=1);

namespace Tests\Feature\Parties;

use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\PublicApi\PlatformCatalog;
use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Parties\Models\Party;
use App\Shared\Tenancy\CurrentOrganization;
use Closure;
use Tests\Feature\Owner\OwnerContext;

final class PartiesContext
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

        if ($role->managesTeam()) {
            activerDeuxFacteurs($compte);
        }

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

    /**
     * Session de navigateur de l'agence avec preuve 2FA fraîche : exigée par les écritures de comptes bancaires.
     */
    public static function sessionAgence(mixed $test, User $compte): mixed
    {
        config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
        OwnerContext::preuve($test);

        return OwnerContext::comme($test, $compte)->withHeaders(OwnerContext::ORIGINE);
    }

    public static function changerDeCompte(mixed $test, User $compte): mixed
    {
        auth()->forgetGuards();
        app()->forgetInstance(CurrentOrganization::class);

        return $test->actingAs($compte);
    }

    public static function url(Organization $organisation, string $chemin = ''): string
    {
        return "/api/v1/org/{$organisation->id}/parties{$chemin}";
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function partie(Organization $organisation, array $attributs = []): Party
    {
        return self::dans($organisation, fn (): Party => Party::factory()->create($attributs));
    }

    public static function terme(string $vocabulaire, string $cle): Term
    {
        return Term::query()->where('vocabulary', $vocabulaire)->where('key', $cle)->firstOrFail();
    }
}
