<?php

declare(strict_types=1);

namespace Tests\Feature\Mandates;

use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\PublicApi\PlatformCatalog;
use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Models\MandateUnit;
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
use Tests\Feature\Documents\DocumentsContext;

final class MandatesContext
{
    public static function semer(): void
    {
        app(PlatformCatalog::class)->seed();
    }

    public static function organisation(OrganizationKind $genre = OrganizationKind::Agency): Organization
    {
        $titulaire = User::factory()->create();
        activerDeuxFacteurs($titulaire);

        return app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData($genre, 'Agence du Port', 'FR'), 'Awa', 'Diallo');
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
        activerDeuxFacteurs($compte);

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

    public static function terme(string $vocabulaire, string $cle): Term
    {
        return Term::query()->whereNull('organization_id')->where('vocabulary', $vocabulaire)->where('key', $cle)->firstOrFail();
    }

    public static function type(string $cle = 'rental_management'): Term
    {
        return self::terme('mandate_type', $cle);
    }

    public static function url(Organization $organisation, string $chemin = ''): string
    {
        return "/api/v1/org/{$organisation->id}/mandates{$chemin}";
    }

    /**
     * Corps valide de création, sur le lot et le mandant donnés.
     *
     * @param  array<string, mixed>  $surcharges
     * @return array<string, mixed>
     */
    public static function payload(Unit $lot, Party $partie, array $surcharges = []): array
    {
        return [
            'mandant_party_id' => $partie->id,
            'mandate_type_term_id' => self::type()->id,
            'starts_on' => '2026-12-01',
            'end_date' => '2027-11-30',
            'tacit_renewal' => false,
            'currency' => 'EUR',
            'terms' => ['fee_kind' => 'percentage', 'fee_basis_points' => 700, 'payout_day' => 5, 'works_limit_amount' => 50000, 'fee_base' => 'rent'],
            'units' => [['unit_id' => $lot->id]],
            ...$surcharges,
        ];
    }

    /**
     * Mandat posé directement en base avec un lot et des conditions initiales ; le brouillon par défaut couvre [2026-01-01, 2029-01-01).
     *
     * @param  array<string, mixed>  $attributs
     */
    public static function mandat(Organization $organisation, Unit $lot, Party $partie, array $attributs = [], MandateStatus $statut = MandateStatus::Draft): Mandate
    {
        return self::dans($organisation, function () use ($lot, $partie, $attributs, $statut): Mandate {
            $mandat = Mandate::factory()->create([
                'mandant_party_id' => $partie->id,
                'mandate_type_term_id' => self::type()->id,
                'status' => $statut,
                'signed_on' => $statut === MandateStatus::Draft ? null : '2025-12-15',
                ...$attributs,
            ]);
            MandateUnit::factory()->create(['mandate_id' => $mandat->id, 'unit_id' => $lot->id, 'valid_from' => $mandat->starts_on->toDateString()]);
            MandateTerm::factory()->create(['mandate_id' => $mandat->id, 'valid_from' => $mandat->starts_on->toDateString()]);

            return $mandat;
        });
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function actif(Organization $organisation, Unit $lot, Party $partie, array $attributs = []): Mandate
    {
        return self::mandat($organisation, $lot, $partie, $attributs, MandateStatus::Active);
    }

    /**
     * Pièce signée d'un avenant : fichier de Documents rattaché au mandat, analysé selon la configuration du test.
     */
    public static function pieceSignee(Organization $organisation, Mandate $mandat, string $contenu = DocumentsContext::PDF): string
    {
        return self::dans($organisation, fn (): string => app(DocumentStore::class)->store(
            FileSource::contents($contenu),
            'avenant-signe.pdf',
            FileCategory::Supporting,
            new DocumentSubject('mandate', $mandat->id),
        )->id);
    }

    /**
     * Un même test qui change d'organisation doit oublier le compte et le contexte de la requête précédente.
     */
    public static function basculer(mixed $test, User $compte): void
    {
        auth()->forgetGuards();
        app()->forgetInstance(CurrentOrganization::class);
        $test->actingAs($compte);
    }

    public static function relire(Organization $organisation, Mandate $mandat): Mandate
    {
        return self::dans($organisation, fn (): Mandate => Mandate::query()->findOrFail($mandat->id));
    }
}
