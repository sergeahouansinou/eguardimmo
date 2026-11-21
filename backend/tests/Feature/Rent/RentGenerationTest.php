<?php

declare(strict_types=1);

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Models\Term;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\RentSchedule;
use App\Shared\Http\ApiProblem;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    C::preparer($this);
});

it('génère l\'échéance du mois courant d\'un bail signé, avec loyer et charges distingués', function (OrganizationKind $type): void {
    $org = C::organisation($type);
    ['bail' => $bail] = C::bail($org);

    expect(C::generer($org, $bail))->toBe(['created' => 1, 'existing' => 0]);

    [$echeance] = C::echeances($org, $bail);

    expect($echeance->status)->toBe(InstallmentStatus::Upcoming)
        ->and($echeance->period_start->toDateString())->toBe('2026-11-01')
        ->and($echeance->period_end->toDateString())->toBe('2026-11-30')
        ->and($echeance->due_date->toDateString())->toBe('2026-11-05')
        ->and($echeance->rent_amount->getAmount())->toBe('65000')
        ->and($echeance->charges_amount->getAmount())->toBe('5000')
        ->and($echeance->total_amount->getAmount())->toBe('70000')
        ->and($echeance->ledger_entry_id)->toBeNull();
})->with([OrganizationKind::Agency, OrganizationKind::Individual]);

it('commence à la période courante : aucun rattrapage d\'un bail signé avec un début passé', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org, ['starts_on' => '2026-01-01']);

    C::generer($org, $bail);

    $debut = L::dans($org, fn () => RentSchedule::query()->where('lease_id', $bail->id)->firstOrFail()->billing_from->toDateString());

    expect($debut)->toBe('2026-11-01')
        ->and(C::echeances($org, $bail))->toHaveCount(1);
});

it('est idempotent : relancer la génération ne crée rien', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org);

    C::generer($org, $bail);

    expect(C::generer($org, $bail))->toBe(['created' => 0, 'existing' => 1])
        ->and(C::echeances($org, $bail))->toHaveCount(1);
});

it('génère la période suivante quand son avis devient émissible, sans toucher la première', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org);
    C::generer($org, $bail);
    [$premiere] = C::echeances($org, $bail);

    expect(C::generer($org, $bail, '2026-11-24'))->toBe(['created' => 0, 'existing' => 1]);
    expect(C::generer($org, $bail, '2026-11-25'))->toBe(['created' => 1, 'existing' => 1]);

    [$a, $b] = C::echeances($org, $bail);

    expect($a->id)->toBe($premiere->id)
        ->and($b->period_start->toDateString())->toBe('2026-12-01')
        ->and($b->due_date->toDateString())->toBe('2026-12-05');
});

it('prorate au jour réel un bail qui commence en cours de mois (février bissextile : 29 jours)', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org, ['starts_on' => '2028-02-10', 'ends_on' => '2031-02-10', 'signed_on' => '2028-02-01'], loyer: 65000, charges: 2900);
    $this->travelTo('2028-02-01 09:00:00');

    C::generer($org, $bail, '2028-02-01');

    [$echeance] = C::echeances($org, $bail);
    $jours = L::dans($org, fn () => $echeance->lines->map(fn ($l): array => [$l->days, $l->month_days])->all());

    expect($jours)->each->toBe([20, 29])
        ->and($echeance->rent_amount->getAmount())->toBe('44828')
        ->and($echeance->charges_amount->getAmount())->toBe('2000');
});

it('prorate un mois de 31 jours sur ses jours réels', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org, ['starts_on' => '2026-12-17', 'ends_on' => '2029-12-17', 'signed_on' => '2026-11-01'], loyer: 62000, charges: 0);

    C::generer($org, $bail, '2026-12-01');

    [$echeance] = C::echeances($org, $bail);

    expect($echeance->rent_amount->getAmount())->toBe('30000');
});

it('un bail non signé ne se facture pas', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org);
    L::dans($org, fn () => $bail->forceFill(['status' => 'draft', 'signed_on' => null])->save());

    expect(fn () => C::generer($org, $bail))->toThrow(ApiProblem::class);
    expect(Installment::query()->withoutGlobalScopes()->count())->toBe(0);
});

it('refuse de facturer une composante sans sémantique connue', function (): void {
    $org = C::organisation();
    ['bail' => $bail] = C::bail($org, charges: 0);
    $libre = Term::factory()->create([
        'organization_id' => $org->id,
        'vocabulary' => VocabularyKey::LeaseComponent->value,
        'key' => 'frais_libres',
        'labels' => ['fr' => 'Frais libres'],
        'metadata' => [],
    ]);
    L::dans($org, fn () => LeaseTerm::query()->where('lease_id', $bail->id)->update(['component_term_id' => $libre->id]));

    expect(fn () => C::generer($org, $bail))->toThrow(ApiProblem::class);
});
