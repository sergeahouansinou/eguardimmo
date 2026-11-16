<?php

declare(strict_types=1);

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\CustomFieldType;
use App\Modules\Catalog\Models\CustomFieldDefinition;
use App\Modules\Leases\Actions\CreateLease;
use App\Modules\Leases\Data\NewLeaseData;
use App\Modules\Leases\Data\NewLeaseTermData;
use App\Modules\Leases\Data\NewLeaseUnitData;
use App\Modules\Leases\Enums\BillingTiming;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\Periodicity;
use App\Modules\Leases\Http\Requests\CreateLeaseRequest;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Support\LeaseSequence;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use App\Shared\Audit\AuditLog;
use Tests\Feature\Leases\LeaseDraftContext as D;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->lot = L::lot($this->org);
    $this->partie = L::partie($this->org);
    $this->payload = fn (array $surcharges = []): array => D::payload($this->lot, $this->partie, $surcharges);
    $this->creer = fn (array $surcharges = []): Lease => D::creer($this->org, ($this->payload)($surcharges));
    $this->refus = fn (array $surcharges): string => D::refus(fn () => ($this->creer)($surcharges));
    $this->terme = fn (string $cle, int $centimes, array $extra = []): array => ['component_term_id' => L::composante($cle)->id, 'amount' => $centimes, ...$extra];
});

it('crée un brouillon complet avec référence, devise et statut fixés par le serveur', function (): void {
    $this->actingAs($this->titulaire);

    $bail = ($this->creer)(['note' => 'Remise des clés le 1er', 'payment_method' => 'transfer']);

    $lu = L::dans($this->org, fn (): Lease => Lease::query()->findOrFail($bail->id));

    expect($lu->reference)->toBe('BL-'.now()->year.'-0001')
        ->and($lu->status)->toBe(LeaseStatus::Draft)
        ->and($lu->currency)->toBe('EUR')
        ->and($lu->lock_version)->toBe(1)
        ->and($lu->created_by_user_id)->toBe($this->titulaire->id)
        ->and($lu->organization_id)->toBe($this->org->id)
        ->and($lu->jurisdiction)->toBe('FR')
        ->and($lu->regime_key)->toBe('fr.residential.unfurnished')
        ->and($lu->duration_months)->toBe(36)
        ->and($lu->tacit_renewal)->toBeTrue()
        ->and($lu->starts_on->toDateString())->toBe('2026-03-01')
        ->and($lu->ends_on?->toDateString())->toBe('2029-03-01')
        ->and($lu->periodicity)->toBe(Periodicity::Monthly)
        ->and($lu->billing_timing)->toBe(BillingTiming::Advance)
        ->and($lu->payment_method?->value)->toBe('transfer')
        ->and($lu->note)->toBe('Remise des clés le 1er')
        ->and($lu->signed_on)->toBeNull();

    $lignes = L::dans($this->org, fn (): array => [
        LeaseUnit::query()->where('lease_id', $bail->id)->get()->all(),
        LeaseParty::query()->where('lease_id', $bail->id)->get()->all(),
        LeaseTerm::query()->where('lease_id', $bail->id)->get()->all(),
    ]);

    expect($lignes[0])->toHaveCount(1)
        ->and($lignes[0][0]->unit_id)->toBe($this->lot->id)
        ->and($lignes[0][0]->is_main)->toBeTrue()
        ->and($lignes[0][0]->valid_from->toDateString())->toBe('2026-03-01')
        ->and($lignes[1][0]->role)->toBe(LeasePartyRole::Tenant)
        ->and($lignes[1][0]->joint_liability)->toBeTrue()
        ->and($lignes[1][0]->valid_from->toDateString())->toBe('2026-03-01')
        ->and($lignes[2][0]->amount->getAmount())->toBe('65000')
        ->and($lignes[2][0]->currency)->toBe('EUR')
        ->and($lignes[2][0]->indexed)->toBeTrue()
        ->and($lignes[2][0]->reason->value)->toBe('initial')
        ->and($lignes[2][0]->valid_from->toDateString())->toBe('2026-03-01')
        ->and($lignes[2][0]->created_by_user_id)->toBe($this->titulaire->id);
});

it('journalise le bail et ses lignes dans la transaction de création', function (): void {
    $this->actingAs($this->titulaire);
    $bail = ($this->creer)();

    $actions = AuditLog::query()->whereIn('subject_type', ['lease', 'lease_unit', 'lease_party', 'lease_term'])->pluck('action')->all();

    expect($actions)->toContain('lease.created', 'lease_unit.created', 'lease_party.created', 'lease_term.created')
        ->and(AuditLog::query()->where('subject_type', 'lease')->where('subject_id', $bail->id)->where('action', 'lease.created')->where('organization_id', $this->org->id)->exists())->toBeTrue();
});

it('ignore tout champ réservé au serveur reçu du client', function (): void {
    $autre = L::organisation();
    $this->actingAs($this->titulaire);

    $donnees = ($this->payload)([
        'status' => 'signed',
        'reference' => 'BL-1999-0001',
        'organization_id' => $autre->id,
        'currency' => 'USD',
        'lock_version' => 9,
        'created_by_user_id' => $autre->created_by_user_id,
        'signed_on' => '2026-01-01',
        'archived_at' => '2026-01-01 00:00:00',
        'ends_on' => '2030-01-01',
    ]);
    $bail = L::dans($this->org, fn (): Lease => app(CreateLease::class)->handle(D::requete(CreateLeaseRequest::class, $donnees)->toData()));

    expect($bail->status)->toBe(LeaseStatus::Draft)
        ->and($bail->reference)->toBe('BL-'.now()->year.'-0001')
        ->and($bail->organization_id)->toBe($this->org->id)
        ->and($bail->currency)->toBe('EUR')
        ->and($bail->lock_version)->toBe(1)
        ->and($bail->created_by_user_id)->toBe($this->titulaire->id)
        ->and($bail->signed_on)->toBeNull()
        ->and($bail->archived_at)->toBeNull()
        ->and($bail->ends_on?->toDateString())->toBe('2029-03-01');
});

it('refuse une juridiction ou un régime non ouvert', function (array $surcharges, string $attendu): void {
    expect(($this->refus)($surcharges))->toBe($attendu);
})->with([
    'Belgique' => [['jurisdiction' => 'BE'], 'jurisdiction_unsupported:422'],
    'régime inconnu' => [['regime_key' => 'fr.residential.inconnu'], 'jurisdiction_unsupported:422'],
    'régime d\'un autre pays' => [['jurisdiction' => 'LU', 'regime_key' => 'fr.residential.furnished'], 'jurisdiction_unsupported:422'],
]);

it('prend la durée et la reconduction du régime et refuse une durée hors bornes', function (): void {
    $meuble = ($this->creer)(['regime_key' => 'fr.residential.furnished']);
    $mobilite = ($this->creer)(['regime_key' => 'fr.residential.mobility', 'duration_months' => 10, 'terms' => []]);

    expect($meuble->duration_months)->toBe(12)
        ->and($meuble->ends_on?->toDateString())->toBe('2027-03-01')
        ->and($meuble->tacit_renewal)->toBeTrue()
        ->and($mobilite->tacit_renewal)->toBeFalse()
        ->and(($this->refus)(['duration_months' => 24]))->toBe('validation:duration_months')
        ->and(($this->refus)(['regime_key' => 'fr.residential.mobility', 'duration_months' => 11, 'terms' => []]))->toBe('validation:duration_months');
});

it('valide les données de juridiction par le régime', function (): void {
    $bail = ($this->creer)(['jurisdiction_data' => ['tense_zone' => true, 'energy_class' => 'C']]);

    expect($bail->jurisdiction_data)->toBe(['tense_zone' => true, 'energy_class' => 'C'])
        ->and(($this->refus)(['jurisdiction_data' => ['admin' => true]]))->toBe('validation:jurisdiction_data.admin')
        ->and(($this->refus)(['jurisdiction_data' => ['energy_class' => 'H']]))->toBe('validation:jurisdiction_data.energy_class');
});

it('valide les champs personnalisés du bail', function (): void {
    L::dans($this->org, fn () => CustomFieldDefinition::factory()->create(['entity' => CustomFieldEntity::Lease, 'key' => 'portail', 'type' => CustomFieldType::Text]));
    L::dans($this->org, fn () => CustomFieldDefinition::factory()->create(['entity' => CustomFieldEntity::Lease, 'key' => 'nb_cles', 'type' => CustomFieldType::Number]));

    $bail = ($this->creer)(['custom_fields' => ['portail' => 'A1234', 'nb_cles' => 3]]);

    expect($bail->custom_fields)->toEqualCanonicalizing(['portail' => 'A1234', 'nb_cles' => 3])
        ->and(($this->refus)(['custom_fields' => ['nb_cles' => 'beaucoup']]))->toBe('validation:custom_fields.nb_cles')
        ->and(($this->refus)(['custom_fields' => ['inconnu' => 'x']]))->toBe('validation:custom_fields.inconnu');
});

it('refuse un lot archivé, hors organisation, ou situé hors de la juridiction du bail', function (): void {
    $archive = L::dans($this->org, fn (): Unit => Unit::factory()->create(['property_id' => $this->lot->property_id, 'unit_type_term_id' => $this->lot->unit_type_term_id, 'archived_at' => now()]));
    $etranger = L::lot(L::organisation());
    $inconnu = ['unit_id' => fake()->uuid(), 'is_main' => true];

    expect(($this->refus)(['units' => [['unit_id' => $archive->id, 'is_main' => true]]]))->toBe('lease_unit_not_available:422')
        ->and(($this->refus)(['units' => [['unit_id' => $etranger->id, 'is_main' => true]]]))->toBe('unit_not_found:404')
        ->and(($this->refus)(['units' => [$inconnu]]))->toBe('unit_not_found:404')
        ->and(Lease::query()->withoutGlobalScopes()->count())->toBe(0);
});

it('exige exactement un lot principal et admet les annexes', function (): void {
    $annexe = D::lotAnnexe($this->org, $this->lot);
    $autre = L::lot($this->org);

    $bail = ($this->creer)(['units' => [['unit_id' => $this->lot->id, 'is_main' => true], ['unit_id' => $annexe->id, 'is_main' => false]]]);

    expect(L::dans($this->org, fn (): int => LeaseUnit::query()->where('lease_id', $bail->id)->count()))->toBe(2)
        ->and(($this->refus)(['units' => [['unit_id' => $this->lot->id, 'is_main' => true], ['unit_id' => $autre->id, 'is_main' => true]]]))->toBe('lease_main_unit_conflict:409')
        ->and(($this->refus)(['units' => [['unit_id' => $this->lot->id, 'is_main' => false]]]))->toBe('lease_no_main_unit:422')
        ->and(($this->refus)(['units' => []]))->toBe('validation:units')
        ->and(($this->refus)(['units' => [['unit_id' => $this->lot->id, 'is_main' => true], ['unit_id' => $this->lot->id, 'is_main' => false]]]))->toBe('validation:units.0.unit_id,units.1.unit_id');
});

it('refuse deux fois le même lot dans l\'Action, hors de la validation de la requête', function (): void {
    $donnees = new NewLeaseData(
        'FR', 'fr.residential.unfurnished', '2026-03-01', null, null, 5, Periodicity::Monthly, BillingTiming::Advance, null, [], [], null,
        [new NewLeaseUnitData($this->lot->id, true), new NewLeaseUnitData($this->lot->id, false)],
        [], [],
    );

    expect(D::refus(fn () => L::dans($this->org, fn () => app(CreateLease::class)->handle($donnees))))->toBe('lease_unit_conflict:409');
});

it('refuse une partie anonymisée, d\'une autre organisation ou en double', function (): void {
    $anonyme = L::dans($this->org, fn (): Party => Party::factory()->create(['anonymized_at' => now()]));
    $etrangere = L::partie(L::organisation());

    expect(($this->refus)(['parties' => [['party_id' => $anonyme->id, 'role' => 'tenant']]]))->toBe('lease_party_not_available:422')
        ->and(($this->refus)(['parties' => [['party_id' => $etrangere->id, 'role' => 'tenant']]]))->toBe('party_not_found:404')
        ->and(($this->refus)(['parties' => [['party_id' => $this->partie->id, 'role' => 'tenant'], ['party_id' => $this->partie->id, 'role' => 'tenant']]]))->toBe('lease_party_conflict:409')
        ->and(($this->refus)(['parties' => [['party_id' => $this->partie->id, 'role' => 'proprietaire']]]))->toBe('validation:parties.0.role');
});

it('porte la caution d\'un garant dans la devise du bail', function (): void {
    $garant = L::partie($this->org);

    $bail = ($this->creer)(['parties' => [
        ['party_id' => $this->partie->id, 'role' => 'tenant'],
        ['party_id' => $garant->id, 'role' => 'guarantor', 'guarantees_party_id' => $this->partie->id, 'guarantee_limit_amount' => 1500000, 'guarantee_ends_on' => '2029-03-01'],
        ['party_id' => L::partie($this->org)->id, 'role' => 'occupant'],
    ]]);

    $ligne = L::dans($this->org, fn (): LeaseParty => LeaseParty::query()->where('lease_id', $bail->id)->where('role', 'guarantor')->firstOrFail());

    expect($ligne->guarantees_party_id)->toBe($this->partie->id)
        ->and($ligne->guarantee_limit_amount?->getAmount())->toBe('1500000')
        ->and($ligne->guarantee_currency)->toBe('EUR')
        ->and($ligne->guarantee_ends_on?->toDateString())->toBe('2029-03-01')
        ->and(L::dans($this->org, fn (): int => LeaseParty::query()->where('lease_id', $bail->id)->count()))->toBe(3);
});

it('refuse une caution mal formée', function (array $parties, string $attendu): void {
    $garant = L::partie($this->org);
    $parties = array_map(fn (array $p): array => array_map(fn (mixed $v): mixed => $v === 'GARANT' ? $garant->id : ($v === 'LOC' ? $this->partie->id : $v), $p), $parties);

    expect(($this->refus)(['parties' => [['party_id' => $this->partie->id, 'role' => 'tenant'], ...$parties]]))->toBe($attendu);
})->with([
    'plafond sur un locataire' => [[['party_id' => 'GARANT', 'role' => 'tenant', 'guarantee_limit_amount' => 1000]], 'validation:parties.1.role'],
    'garant d\'une partie absente' => [[['party_id' => 'GARANT', 'role' => 'guarantor', 'guarantees_party_id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']], 'lease_party_not_found:404'],
    'garant d\'un garant' => [[['party_id' => 'GARANT', 'role' => 'guarantor'], ['party_id' => 'GARANT', 'role' => 'occupant', 'guarantees_party_id' => 'GARANT']], 'validation:parties.2.role'],
    'fin de caution avant le début' => [[['party_id' => 'GARANT', 'role' => 'guarantor', 'guarantee_ends_on' => '2026-03-01']], 'lease_period_invalid:422'],
    'plafond nul' => [[['party_id' => 'GARANT', 'role' => 'guarantor', 'guarantee_limit_amount' => 0]], 'validation:parties.1.guarantee_limit_amount'],
]);

it('contrôle le dépôt de garantie contre le plafond du régime, à la limite exacte', function (string $regime, array $donneesJuridiction, int $depot, string $attendu): void {
    $terms = [($this->terme)('rent', 100000), ($this->terme)('deposit', $depot)];

    expect(($this->refus)(['regime_key' => $regime, 'jurisdiction_data' => $donneesJuridiction, 'terms' => $terms]))->toBe($attendu);
})->with([
    'vide : limite exacte (1 mois)' => ['fr.residential.unfurnished', [], 100000, ''],
    'vide : un centime de plus' => ['fr.residential.unfurnished', [], 100001, 'lease_deposit_over_cap:422'],
    'vide : loyer d\'avance au-delà de 2 mois, dépôt interdit' => ['fr.residential.unfurnished', ['advance_rent_over_two_months' => true], 1, 'lease_deposit_over_cap:422'],
    'meublé : limite exacte (2 mois)' => ['fr.residential.furnished', [], 200000, ''],
    'meublé : un centime de plus' => ['fr.residential.furnished', [], 200001, 'lease_deposit_over_cap:422'],
    'mobilité : dépôt interdit' => ['fr.residential.mobility', [], 1, 'lease_deposit_over_cap:422'],
    'droit commun : aucun plafond' => ['fr.common_law', [], 999999999, ''],
]);

it('refuse un dépôt sans loyer quand le régime plafonne', function (): void {
    expect(($this->refus)(['terms' => [($this->terme)('deposit', 100)]]))->toBe('lease_deposit_over_cap:422')
        ->and(($this->refus)(['terms' => [($this->terme)('deposit', 0)]]))->toBe('');
});

it('ne retient aucun bail ni numéro quand la création échoue', function (): void {
    expect(($this->refus)(['terms' => [($this->terme)('rent', 100000), ($this->terme)('deposit', 100001)]]))->toBe('lease_deposit_over_cap:422');

    $suivant = L::dans($this->org, fn (): string => app(LeaseSequence::class)->next(now()->year));

    expect(Lease::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(LeaseUnit::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(LeaseTerm::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and($suivant)->toBe('BL-'.now()->year.'-0001');
});

it('refuse les composantes invalides', function (array $terms, string $attendu): void {
    expect(($this->refus)(['terms' => $terms]))->toBe($attendu);
})->with([
    'valeur d\'un autre vocabulaire' => fn () => [[['component_term_id' => L::terme('unit_type', 'apartment')->id, 'amount' => 100]], 'lease_component_invalid:422'],
    'valeur inconnue' => [[['component_term_id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'amount' => 100]], 'lease_component_invalid:422'],
    'montant négatif' => [[['component_term_id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'amount' => -1]], 'validation:terms.0.amount'],
    'TVA hors bornes' => [[['component_term_id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'amount' => 1, 'vat_bp' => 10001]], 'validation:terms.0.vat_bp'],
]);

it('refuse une composante deux fois, ou hors de la période du bail', function (): void {
    expect(($this->refus)(['terms' => [($this->terme)('rent', 1000), ($this->terme)('rent', 2000)]]))->toBe('validation:terms.0.component_term_id,terms.1.component_term_id')
        ->and(($this->refus)(['terms' => [($this->terme)('rent', 1000, ['valid_from' => '2026-02-28'])]]))->toBe('lease_period_invalid:422')
        ->and(($this->refus)(['terms' => [($this->terme)('rent', 1000, ['valid_from' => '2029-03-01'])]]))->toBe('lease_period_invalid:422')
        ->and(($this->refus)(['terms' => [($this->terme)('rent', 1000, ['valid_from' => '2026-09-01'])]]))->toBe('');
});

it('refuse une composante en double quand l\'Action est appelée sans la requête', function (): void {
    $ligne = new NewLeaseTermData(L::composante('rent')->id, 1000);
    $donnees = new NewLeaseData(
        'FR', 'fr.residential.unfurnished', '2026-03-01', null, null, 5, Periodicity::Monthly, BillingTiming::Advance, null, [], [], null,
        [new NewLeaseUnitData($this->lot->id, true)], [], [$ligne, $ligne],
    );

    expect(D::refus(fn () => L::dans($this->org, fn () => app(CreateLease::class)->handle($donnees))))->toBe('lease_term_overlap:409');
});

it('valide la requête de création en liste blanche', function (array $surcharges, array $cles): void {
    $erreurs = D::refus(fn () => D::requete(CreateLeaseRequest::class, D::payload($this->lot, $this->partie, $surcharges)));

    expect($erreurs)->toBe('validation:'.implode(',', $cles));
})->with([
    'jour d\'échéance 29' => [['due_day' => 29], ['due_day']],
    'périodicité inconnue' => [['periodicity' => 'weekly'], ['periodicity']],
    'juridiction en minuscules' => [['jurisdiction' => 'fr'], ['jurisdiction']],
    'date mal formée' => [['starts_on' => '01/03/2026'], ['starts_on']],
    'mode de paiement inconnu' => [['payment_method' => 'bitcoin'], ['payment_method']],
    'durée nulle' => [['duration_months' => 0], ['duration_months']],
    'montant à virgule' => [['terms' => [['component_term_id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'amount' => 10.5]]], ['terms.0.amount']],
    'lot sans identifiant' => [['units' => [['is_main' => true]]], ['units.0.unit_id']],
]);

it('exige les champs obligatoires de la requête de création', function (): void {
    expect(D::refus(fn () => D::requete(CreateLeaseRequest::class, [])))
        ->toBe('validation:jurisdiction,regime_key,starts_on,due_day,periodicity,billing_timing,units');
});
