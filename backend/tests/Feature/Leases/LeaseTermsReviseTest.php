<?php

declare(strict_types=1);

use App\Modules\Leases\Events\LeaseTermsRevised;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Money\Money;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeaseTermsReviseContext as T;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->bail = T::bail($this->org);
    $this->loyer = T::ligne($this->org, $this->bail, 'rent', 65000);
    $this->actingAs($this->titulaire);
});

/**
 * @return list<array{componentKey: string, amount: int, from: string, to: string|null}>
 */
function leaseTermLignes(object $test, string $de, string $a): array
{
    return L::dans($test->org, fn (): array => array_map(
        fn ($l): array => ['componentKey' => $l->componentKey, 'amount' => (int) $l->amount->getAmount(), 'from' => $l->validFrom, 'to' => $l->validTo],
        app(LeaseSchedule::class)->linesBetween($test->bail->id, CarbonImmutable::parse($de), CarbonImmutable::parse($a)),
    ));
}

it('ferme la ligne en vigueur, ouvre la nouvelle à la date d\'effet et chaîne replaces_id', function (): void {
    $reponse = $this->postJson(T::url($this->org, $this->bail), T::corps($this->bail, '2026-07-01', [T::changer('rent', 66500)]));

    $reponse->assertOk()
        ->assertJsonPath('meta.lock_version', 2)
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.end_date', '2026-06-30')
        ->assertJsonPath('data.1.valid_from', '2026-07-01')
        ->assertJsonPath('data.1.amount.amount', 66500)
        ->assertJsonPath('data.1.amount.currency', 'EUR')
        ->assertJsonPath('data.1.reason', 'revision')
        ->assertJsonPath('data.1.replaces_id', $this->loyer->id);

    $nouvelle = L::dans($this->org, fn () => LeaseTerm::query()->where('replaces_id', $this->loyer->id)->firstOrFail());
    $ancienne = L::dans($this->org, fn () => LeaseTerm::query()->findOrFail($this->loyer->id));

    expect($ancienne->valid_to?->toDateString())->toBe('2026-07-01')
        ->and($ancienne->valid_from->toDateString())->toBe('2026-01-01')
        ->and($ancienne->amount->getAmount())->toBe('65000')
        ->and($nouvelle->valid_to)->toBeNull()
        ->and($nouvelle->created_by_user_id)->toBe($this->titulaire->id)
        ->and($nouvelle->organization_id)->toBe($this->org->id)
        ->and(L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id)->lock_version))->toBe(2);
});

it('bascule exactement au jour d\'effet : l\'ancienne valeur avant, la nouvelle à partir de ce jour', function (): void {
    $this->postJson(T::url($this->org, $this->bail), T::corps($this->bail, '2026-07-01', [T::changer('rent', 66500)]))->assertOk();

    expect(leaseTermLignes($this, '2026-06-30', '2026-06-30'))->toBe([['componentKey' => 'rent', 'amount' => 65000, 'from' => '2026-01-01', 'to' => '2026-07-01']])
        ->and(leaseTermLignes($this, '2026-07-01', '2026-07-01'))->toBe([['componentKey' => 'rent', 'amount' => 66500, 'from' => '2026-07-01', 'to' => null]])
        ->and(leaseTermLignes($this, '2026-06-30', '2026-07-01'))->toHaveCount(2)
        ->and(leaseTermLignes($this, '2026-01-01', '2026-01-01')[0]['amount'])->toBe(65000);
});

it('révise plusieurs composantes d\'un coup et garde TVA et indexation de la ligne remplacée sauf si fournies', function (): void {
    $provision = T::ligne($this->org, $this->bail, 'charges_provision', 8000, ['indexed' => false, 'vat_bp' => 1000]);
    $corps = T::corps($this->bail, '2026-09-01', [
        T::changer('rent', 66500),
        T::changer('charges_provision', 9000, ['vat_bp' => 550, 'indexed' => true]),
    ], ['reason' => 'amendment']);

    $this->postJson(T::url($this->org, $this->bail), $corps)->assertOk()->assertJsonCount(4, 'data');

    $loyer = L::dans($this->org, fn () => LeaseTerm::query()->where('replaces_id', $this->loyer->id)->firstOrFail());
    $charges = L::dans($this->org, fn () => LeaseTerm::query()->where('replaces_id', $provision->id)->firstOrFail());

    expect($loyer->vat_bp)->toBe(0)
        ->and($loyer->indexed)->toBeTrue()
        ->and($loyer->reason->value)->toBe('amendment')
        ->and($charges->vat_bp)->toBe(550)
        ->and($charges->indexed)->toBeTrue()
        ->and(L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id)->lock_version))->toBe(2);
});

it('garde la TVA et l\'indexation de la ligne remplacée quand elles ne sont pas fournies', function (): void {
    $provision = T::ligne($this->org, $this->bail, 'charges_provision', 8000, ['indexed' => false, 'vat_bp' => 1000]);

    $this->postJson(T::url($this->org, $this->bail), T::corps($this->bail, '2026-09-01', [T::changer('charges_provision', 9000)], ['reason' => 'correction']))->assertOk();

    $nouvelle = L::dans($this->org, fn () => LeaseTerm::query()->where('replaces_id', $provision->id)->firstOrFail());

    expect($nouvelle->vat_bp)->toBe(1000)->and($nouvelle->indexed)->toBeFalse();
});

it('supprime une composante à compter d\'une date sans ouvrir de ligne', function (): void {
    $supplement = T::ligne($this->org, $this->bail, 'rent_supplement', 5000);

    $this->postJson(T::url($this->org, $this->bail), T::corps($this->bail, '2026-10-01', [
        ['component_term_id' => L::composante('rent_supplement')->id, 'close' => true],
    ], ['reason' => 'amendment']))->assertOk();

    expect(T::historique($this->org, $this->bail, 'rent_supplement'))->toBe([['from' => '2026-01-01', 'to' => '2026-10-01', 'amount' => 5000]])
        ->and(leaseTermLignes($this, '2026-09-30', '2026-09-30'))->toHaveCount(2)
        ->and(array_column(leaseTermLignes($this, '2026-10-01', '2026-10-01'), 'componentKey'))->toBe(['rent'])
        ->and(L::dans($this->org, fn () => LeaseTerm::query()->findOrFail($supplement->id)->replaces_id))->toBeNull();
});

it('ne touche jamais aux lignes passées', function (): void {
    $this->postJson(T::url($this->org, $this->bail), T::corps($this->bail, '2026-04-01', [T::changer('rent', 66000)]))->assertOk();
    $bail = L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id));
    $this->postJson(T::url($this->org, $this->bail), T::corps($bail, '2027-04-01', [T::changer('rent', 67000)]))->assertOk();

    expect(T::historique($this->org, $this->bail, 'rent'))->toBe([
        ['from' => '2026-01-01', 'to' => '2026-04-01', 'amount' => 65000],
        ['from' => '2026-04-01', 'to' => '2027-04-01', 'amount' => 66000],
        ['from' => '2027-04-01', 'to' => null, 'amount' => 67000],
    ])->and(L::dans($this->org, fn () => LeaseTerm::query()->where('lease_id', $this->bail->id)->count()))->toBe(3);
});

it('garde la fin d\'une ligne bornée sur sa remplaçante et accepte la ligne suivante qui la prolonge', function (): void {
    T::ligne($this->org, $this->bail, 'rent_supplement', 5000, ['valid_to' => '2026-12-01']);
    T::ligne($this->org, $this->bail, 'rent_supplement', 4000, ['valid_from' => '2026-12-01']);

    $this->postJson(T::url($this->org, $this->bail), T::corps($this->bail, '2026-06-01', [T::changer('rent_supplement', 6000)], ['reason' => 'amendment']))->assertOk();

    expect(T::historique($this->org, $this->bail, 'rent_supplement'))->toBe([
        ['from' => '2026-01-01', 'to' => '2026-06-01', 'amount' => 5000],
        ['from' => '2026-06-01', 'to' => '2026-12-01', 'amount' => 6000],
        ['from' => '2026-12-01', 'to' => null, 'amount' => 4000],
    ]);
});

it('impose la devise du bail, jamais celle du client', function (): void {
    $bail = T::bail($this->org, ['currency' => 'XOF', 'reference' => 'BL-2026-0099']);
    L::dans($this->org, fn () => LeaseTerm::factory()->create([
        'lease_id' => $bail->id, 'component_term_id' => L::composante('rent')->id, 'amount' => Money::XOF(150000), 'valid_from' => '2026-01-01',
    ]));

    $this->postJson(T::url($this->org, $bail), T::corps($bail, '2026-07-01', [T::changer('rent', 160000, ['currency' => 'USD'])]))
        ->assertOk()
        ->assertJsonPath('data.1.amount.currency', 'XOF')
        ->assertJsonPath('data.1.amount.amount', 160000);

    expect(L::dans($this->org, fn () => LeaseTerm::query()->where('lease_id', $bail->id)->pluck('currency')->unique()->values()->all()))->toBe(['XOF']);
});

it('écrit le journal d\'audit de la révision et des lignes touchées', function (): void {
    $this->postJson(T::url($this->org, $this->bail), T::corps($this->bail, '2026-07-01', [T::changer('rent', 66500)]))->assertOk();

    $revision = AuditLog::query()->where('action', 'leases.terms.revised')->firstOrFail();
    $nouvelle = L::dans($this->org, fn () => LeaseTerm::query()->where('replaces_id', $this->loyer->id)->firstOrFail());

    expect($revision->subject_id)->toBe($this->bail->id)
        ->and($revision->actor_user_id)->toBe($this->titulaire->id)
        ->and($revision->organization_id)->toBe($this->org->id)
        ->and($revision->metadata)->toMatchArray(['effective_on' => '2026-07-01', 'reason' => 'revision', 'opened' => 1, 'closed' => 0])
        ->and(AuditLog::query()->where('subject_id', $this->loyer->id)->where('action', 'like', '%updated')->exists())->toBeTrue()
        ->and(AuditLog::query()->where('subject_id', $nouvelle->id)->where('action', 'like', '%created')->exists())->toBeTrue();
});

it('publie LeaseTermsRevised avec les identifiants et la date d\'effet seulement', function (): void {
    Event::fake([LeaseTermsRevised::class]);

    $this->postJson(T::url($this->org, $this->bail), T::corps($this->bail, '2026-07-01', [T::changer('rent', 66500)]))->assertOk();

    Event::assertDispatched(LeaseTermsRevised::class, fn (LeaseTermsRevised $e): bool => $e->leaseId === $this->bail->id
        && $e->organizationId === $this->org->id && $e->effectiveOn === '2026-07-01');
});

it('relit les lignes après avoir pris le verrou du bail : une ligne programmée entre-temps est comptée', function (): void {
    $niveau = DB::transactionLevel();
    $declenchee = false;
    DB::listen(function ($requete) use (&$declenchee, $niveau): void {
        if ($declenchee || DB::transactionLevel() <= $niveau || ! str_contains($requete->sql, 'from "leases"')) {
            return;
        }

        $declenchee = true;
        DB::table('lease_terms')->insert([
            'id' => (string) Str::uuid7(), 'organization_id' => $this->org->id, 'lease_id' => $this->bail->id,
            'component_term_id' => L::composante('rent')->id, 'amount' => 70000, 'currency' => 'EUR', 'vat_bp' => 0, 'indexed' => 1,
            'valid_from' => '2026-09-01', 'valid_to' => null, 'reason' => 'amendment', 'created_at' => now(), 'updated_at' => now(),
        ]);
    });

    $this->postJson(T::url($this->org, $this->bail), T::corps($this->bail, '2026-07-01', [T::changer('rent', 66500)]))
        ->assertConflict()->assertJsonPath('code', 'lease_term_overlap');

    expect($declenchee)->toBeTrue()
        ->and(L::dans($this->org, fn () => LeaseTerm::query()->findOrFail($this->loyer->id)->valid_to))->toBeNull()
        ->and(L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id)->lock_version))->toBe(1);
});
