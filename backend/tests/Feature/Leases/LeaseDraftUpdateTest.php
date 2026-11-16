<?php

declare(strict_types=1);

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\CustomFieldType;
use App\Modules\Catalog\Models\CustomFieldDefinition;
use App\Modules\Leases\Actions\UpdateLease;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Http\Requests\UpdateLeaseRequest;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Queries\Leases;
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
    $this->bail = D::creer($this->org, D::payload($this->lot, $this->partie, [
        'terms' => [['component_term_id' => L::composante('rent')->id, 'amount' => 100000], ['component_term_id' => L::composante('deposit')->id, 'amount' => 100000]],
    ]));
    $this->modifier = fn (array $donnees, ?Lease $bail = null): Lease => L::dans($this->org, function () use ($donnees, $bail): Lease {
        $courant = $bail ?? $this->bail;

        return app(UpdateLease::class)->handle(
            Lease::query()->findOrFail($courant->id),
            D::requete(UpdateLeaseRequest::class, ['lock_version' => Lease::query()->findOrFail($courant->id)->lock_version, ...$donnees])->toData(),
        );
    });
    $this->refus = fn (array $donnees, ?Lease $bail = null): string => D::refus(fn () => ($this->modifier)($donnees, $bail));
    $this->signe = fn (): Lease => L::dans($this->org, function (): Lease {
        $bail = Lease::query()->findOrFail($this->bail->id);
        $bail->update(['status' => LeaseStatus::Signed, 'signed_on' => '2026-02-15']);

        return $bail;
    });
    $this->lignes = fn (string $modele, ?Lease $bail = null) => L::dans($this->org, fn () => $modele::query()->where('lease_id', ($bail ?? $this->bail)->id)->get());
});

it('modifie un brouillon, recalcule la fin et incrémente la version', function (): void {
    $bail = ($this->modifier)(['due_day' => 10, 'periodicity' => 'quarterly', 'billing_timing' => 'arrears', 'note' => 'Révisé', 'payment_method' => 'direct_debit', 'duration_months' => 48, 'tacit_renewal' => false]);

    expect($bail->lock_version)->toBe(2)
        ->and($bail->due_day)->toBe(10)
        ->and($bail->periodicity->value)->toBe('quarterly')
        ->and($bail->billing_timing->value)->toBe('arrears')
        ->and($bail->payment_method?->value)->toBe('direct_debit')
        ->and($bail->note)->toBe('Révisé')
        ->and($bail->duration_months)->toBe(48)
        ->and($bail->tacit_renewal)->toBeFalse()
        ->and($bail->ends_on?->toDateString())->toBe('2030-03-01')
        ->and($bail->reference)->toBe($this->bail->reference)
        ->and($bail->status)->toBe(LeaseStatus::Draft);
});

it('exige la version et refuse une version périmée sans rien écrire', function (): void {
    $this->actingAs($this->titulaire);

    expect(D::refus(fn () => D::requete(UpdateLeaseRequest::class, ['note' => 'x'])))->toBe('validation:lock_version');

    ($this->modifier)(['note' => 'première']);

    $perime = D::refus(fn () => L::dans($this->org, fn () => app(UpdateLease::class)->handle(
        Lease::query()->findOrFail($this->bail->id),
        D::requete(UpdateLeaseRequest::class, ['lock_version' => 1, 'note' => 'seconde'])->toData(),
    )));
    $apres = L::dans($this->org, fn (): Lease => Lease::query()->findOrFail($this->bail->id));

    expect($perime)->toBe('lease_stale_version:409')
        ->and($apres->note)->toBe('première')
        ->and($apres->lock_version)->toBe(2);
});

it('ignore les champs réservés au serveur reçus du client', function (): void {
    $autre = L::organisation();

    $bail = ($this->modifier)(['note' => 'ok', 'status' => 'signed', 'reference' => 'BL-1999-0001', 'organization_id' => $autre->id, 'currency' => 'USD', 'signed_on' => '2026-01-01', 'created_by_user_id' => $autre->created_by_user_id, 'archived_at' => '2026-01-01 00:00:00']);

    expect($bail->status)->toBe(LeaseStatus::Draft)
        ->and($bail->reference)->toBe($this->bail->reference)
        ->and($bail->organization_id)->toBe($this->org->id)
        ->and($bail->currency)->toBe('EUR')
        ->and($bail->signed_on)->toBeNull()
        ->and($bail->archived_at)->toBeNull()
        ->and($bail->created_by_user_id)->toBe($this->bail->created_by_user_id)
        ->and($bail->lock_version)->toBe(2);
});

it('déplace avec le début du bail les lignes ouvertes à cette date', function (): void {
    ($this->modifier)(['starts_on' => '2026-04-15']);

    expect(($this->lignes)(LeaseUnit::class)->pluck('valid_from')->map->toDateString()->unique()->all())->toBe(['2026-04-15'])
        ->and(($this->lignes)(LeaseParty::class)->pluck('valid_from')->map->toDateString()->all())->toBe(['2026-04-15'])
        ->and(($this->lignes)(LeaseTerm::class)->pluck('valid_from')->map->toDateString()->unique()->all())->toBe(['2026-04-15']);
});

it('remplace lots, parties et composantes dans la même transaction', function (): void {
    $autreLot = L::lot($this->org);
    $autrePartie = L::partie($this->org);

    $bail = ($this->modifier)([
        'units' => [['unit_id' => $autreLot->id, 'is_main' => true]],
        'parties' => [['party_id' => $autrePartie->id, 'role' => 'tenant'], ['party_id' => $this->partie->id, 'role' => 'occupant']],
        'terms' => [['component_term_id' => L::composante('rent')->id, 'amount' => 80000], ['component_term_id' => L::composante('charges_provision')->id, 'amount' => 5000]],
    ]);

    expect(($this->lignes)(LeaseUnit::class)->pluck('unit_id')->all())->toBe([$autreLot->id])
        ->and(($this->lignes)(LeaseParty::class)->pluck('party_id')->all())->toEqualCanonicalizing([$autrePartie->id, $this->partie->id])
        ->and(($this->lignes)(LeaseTerm::class)->map(fn (LeaseTerm $t): string => $t->amount->getAmount())->all())->toEqualCanonicalizing(['80000', '5000'])
        ->and($bail->lock_version)->toBe(2)
        ->and(AuditLog::query()->where('action', 'lease_unit.deleted')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'lease_term.deleted')->count())->toBe(2);
});

it('laisse intactes les lignes non transmises', function (): void {
    ($this->modifier)(['note' => 'seule la note']);

    expect(($this->lignes)(LeaseUnit::class))->toHaveCount(1)
        ->and(($this->lignes)(LeaseParty::class))->toHaveCount(1)
        ->and(($this->lignes)(LeaseTerm::class))->toHaveCount(2);
});

it('annule tout quand le remplacement est refusé', function (array $donnees, string $attendu): void {
    $termsAvant = ($this->lignes)(LeaseTerm::class)->pluck('id')->sort()->values()->all();
    $archive = L::dans($this->org, fn () => Unit::factory()->create(['property_id' => $this->lot->property_id, 'unit_type_term_id' => $this->lot->unit_type_term_id, 'archived_at' => now()]));
    $remplacements = ['LOYER' => L::composante('rent')->id, 'DEPOT' => L::composante('deposit')->id];

    if (($donnees['units'] ?? null) === 'ARCHIVE') {
        $donnees['units'] = [['unit_id' => $archive->id, 'is_main' => true]];
    }

    if (isset($donnees['terms'])) {
        $donnees['terms'] = array_map(fn (array $t): array => [...$t, 'component_term_id' => $remplacements[$t['component_term_id']]], $donnees['terms']);
    }

    expect(($this->refus)(['note' => 'ne doit pas rester', ...$donnees]))->toBe($attendu);

    $apres = L::dans($this->org, fn (): Lease => Lease::query()->findOrFail($this->bail->id));

    expect($apres->note)->toBeNull()
        ->and($apres->lock_version)->toBe(1)
        ->and(($this->lignes)(LeaseTerm::class)->pluck('id')->sort()->values()->all())->toBe($termsAvant)
        ->and(($this->lignes)(LeaseUnit::class))->toHaveCount(1);
})->with([
    'dépôt au-dessus du plafond' => [['terms' => [['component_term_id' => 'LOYER', 'amount' => 100000], ['component_term_id' => 'DEPOT', 'amount' => 100001]]], 'lease_deposit_over_cap:422'],
    'lot archivé' => [['units' => 'ARCHIVE'], 'lease_unit_not_available:422'],
]);

it('revérifie le plafond quand seules les données de juridiction changent', function (): void {
    expect(($this->refus)(['jurisdiction_data' => ['advance_rent_over_two_months' => true]]))->toBe('lease_deposit_over_cap:422')
        ->and(($this->refus)(['regime_key' => 'fr.residential.mobility', 'duration_months' => 10]))->toBe('lease_deposit_over_cap:422')
        ->and(($this->refus)(['jurisdiction_data' => ['tense_zone' => true]]))->toBe('');
});

it('refuse un changement de durée hors du régime sans rien écrire', function (): void {
    expect(($this->refus)(['duration_months' => 12]))->toBe('validation:duration_months')
        ->and(($this->refus)(['jurisdiction' => 'BE']))->toBe('jurisdiction_unsupported:422');
});

it('ne laisse modifier que la note, le moyen de paiement et les champs personnalisés d\'un bail signé', function (): void {
    L::dans($this->org, fn () => CustomFieldDefinition::factory()->create(['entity' => CustomFieldEntity::Lease, 'key' => 'portail', 'type' => CustomFieldType::Text]));
    ($this->signe)();

    $bail = ($this->modifier)(['note' => 'après signature', 'payment_method' => 'cheque', 'custom_fields' => ['portail' => 'B9']]);

    expect($bail->note)->toBe('après signature')
        ->and($bail->payment_method?->value)->toBe('cheque')
        ->and($bail->custom_fields)->toBe(['portail' => 'B9'])
        ->and($bail->lock_version)->toBe(2)
        ->and($bail->status)->toBe(LeaseStatus::Signed)
        ->and($bail->due_day)->toBe(5);
});

it('refuse sur un bail signé tout autre champ, lots, parties et composantes compris', function (array $donnees): void {
    ($this->signe)();

    expect(($this->refus)($donnees))->toBe('lease_not_draft:409');

    $apres = L::dans($this->org, fn (): Lease => Lease::query()->findOrFail($this->bail->id));

    expect($apres->lock_version)->toBe(1)
        ->and($apres->due_day)->toBe(5)
        ->and($apres->note)->toBeNull()
        ->and(($this->lignes)(LeaseTerm::class))->toHaveCount(2);
})->with([
    'jour d\'échéance' => [['due_day' => 10]],
    'début' => [['starts_on' => '2026-06-01']],
    'durée' => [['duration_months' => 48]],
    'régime' => [['regime_key' => 'fr.common_law']],
    'données de juridiction' => [['jurisdiction_data' => ['tense_zone' => true]]],
    'périodicité' => [['periodicity' => 'annual']],
    'note acceptée mais jour refusé' => [['note' => 'x', 'due_day' => 10]],
    'composantes' => [['terms' => []]],
    'parties' => [['parties' => []]],
]);

it('refuse la modification d\'un bail terminé, annulé ou archivé', function (): void {
    L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id)->update(['status' => LeaseStatus::Cancelled]));
    expect(($this->refus)(['note' => 'x']))->toBe('lease_already_terminated:409');

    L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id)->update(['status' => LeaseStatus::Terminated, 'signed_on' => '2026-02-15']));
    expect(($this->refus)(['note' => 'x']))->toBe('lease_already_terminated:409');

    L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id)->update(['status' => LeaseStatus::Draft, 'archived_at' => now()]));
    expect(($this->refus)(['note' => 'x']))->toBe('lease_archived:409');
});

it('journalise la modification avec le différentiel', function (): void {
    ($this->modifier)(['due_day' => 12]);

    $ligne = AuditLog::query()->where('subject_type', 'lease')->where('subject_id', $this->bail->id)->where('action', 'lease.updated')->firstOrFail();

    expect($ligne->changes['due_day'])->toBe(['old' => 5, 'new' => 12])
        ->and($ligne->changes['lock_version'])->toBe(['old' => 1, 'new' => 2]);
});

it('ne voit pas, ne modifie pas le bail d\'une autre organisation', function (): void {
    $autre = L::organisation();
    $etranger = D::creer($autre, D::payload(L::lot($autre), L::partie($autre)));

    $depuisAutre = D::refus(fn () => L::dans($this->org, fn () => app(UpdateLease::class)->handle(
        $etranger,
        D::requete(UpdateLeaseRequest::class, ['lock_version' => 1, 'note' => 'intrusion'])->toData(),
    )));
    $recherche = D::refus(fn () => L::dans($this->org, fn () => app(Leases::class)->get($etranger->id)));

    expect($depuisAutre)->toBe('lease_not_found:404')
        ->and($recherche)->toBe('lease_not_found:404')
        ->and(L::dans($autre, fn (): ?string => Lease::query()->findOrFail($etranger->id)->note))->toBeNull();
});

it('valide la requête de modification en liste blanche', function (array $donnees, string $attendu): void {
    expect(D::refus(fn () => D::requete(UpdateLeaseRequest::class, $donnees)))->toBe($attendu);
})->with([
    'version à zéro' => [['lock_version' => 0], 'validation:lock_version'],
    'jour hors bornes' => [['lock_version' => 1, 'due_day' => 0], 'validation:due_day'],
    'régime vidé' => [['lock_version' => 1, 'regime_key' => ''], 'validation:regime_key'],
    'liste de lots vide' => [['lock_version' => 1, 'units' => []], 'validation:units'],
    'rôle inconnu' => [['lock_version' => 1, 'parties' => [['party_id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'role' => 'x']]], 'validation:parties.0.role'],
]);
