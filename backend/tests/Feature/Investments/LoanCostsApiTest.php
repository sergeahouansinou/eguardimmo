<?php

declare(strict_types=1);

use App\Modules\Investments\PublicApi\Acquisitions;
use App\Modules\Investments\PublicApi\LoanCosts;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Investments\InvestmentsContext as I;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    I::preparer($this);
    $this->b = I::bailleur();
    I::comme($this, $this->b['owner']);
    // Échéances le 31/12/2025, 31/01/2026 et 28/02/2026 : intérêts 12000, 8040 et 4040 (références calculées à part).
    $this->id = I::pret($this, $this->b, ['principal' => 1200000, 'nominal_rate' => '12', 'term_months' => 3, 'first_due_on' => '2025-12-31'])->assertCreated()->json('data.id');
});

function coutsDe(array $b, int $annee): array
{
    return L::dans($b['org'], fn (): array => app(LoanCosts::class)->deductible($annee));
}

it('intérêts payés dans l\'année d\'après l\'échéancier : bornes semi-ouvertes autour du 31 décembre', function (): void {
    $c2025 = coutsDe($this->b, 2025);
    $c2026 = coutsDe($this->b, 2026);

    expect($c2025)->toHaveCount(1)->and($c2025[0]->source)->toBe('schedule')->and($c2025[0]->interest->getAmount())->toBe('12000')
        ->and($c2026[0]->interest->getAmount())->toBe((string) (8040 + 4040))->and(coutsDe($this->b, 2027))->toBe([]);
});

it('l\'attestation de la banque l\'emporte sur l\'échéancier pour son année seulement', function (): void {
    $this->post(I::url($this->b['org'], "/loans/{$this->id}/attestations"), ['income_year' => 2026, 'interest' => 11500, 'insurance' => 900, 'fees' => 300, 'document' => I::pdf('a.pdf')], ['Accept' => 'application/json'])->assertCreated();

    $c2026 = coutsDe($this->b, 2026)[0];

    expect($c2026->source)->toBe('attestation')->and($c2026->interest->getAmount())->toBe('11500')->and($c2026->insurance->getAmount())->toBe('900')->and($c2026->fees->getAmount())->toBe('300')
        ->and(coutsDe($this->b, 2025)[0]->source)->toBe('schedule');
});

it('frais payés dans l\'année ajoutés à l\'échéancier, un prêt annulé sort des lectures', function (): void {
    $this->post(I::url($this->b['org'], "/loans/{$this->id}/fees"), ['kind' => 'dossier', 'paid_on' => '2025-12-31', 'amount' => 15000], ['Accept' => 'application/json'])->assertCreated();
    $this->post(I::url($this->b['org'], "/loans/{$this->id}/fees"), ['kind' => 'guarantee', 'paid_on' => '2026-01-01', 'amount' => 7000], ['Accept' => 'application/json'])->assertCreated();

    expect(coutsDe($this->b, 2025)[0]->fees->getAmount())->toBe('15000')->and(coutsDe($this->b, 2026)[0]->fees->getAmount())->toBe('7000');

    $this->postJson(I::url($this->b['org'], "/loans/{$this->id}/void"), ['reason' => 'Erreur', 'lock_version' => 1])->assertOk();

    expect(coutsDe($this->b, 2025))->toBe([])
        ->and(L::dans($this->b['org'], fn (): array => app(LoanCosts::class)->trackedProperties(2025)))->toBe([]);
});

it('biens suivis, échéances d\'une fenêtre et coût de revient exposés par la PublicApi, cloisonnés par organisation', function (): void {
    $this->postJson(I::url($this->b['org'], '/acquisitions'), ['property_id' => $this->b['property'], 'acquired_on' => '2020-05-01', 'price' => 20000000, 'initial_works' => 100], ['Idempotency-Key' => 'acq-publicapi-1'])->assertCreated();

    $lues = L::dans($this->b['org'], fn (): array => app(LoanCosts::class)->installments(CarbonImmutable::parse('2026-01-01'), CarbonImmutable::parse('2026-02-28')));
    $acq = L::dans($this->b['org'], fn (): array => app(Acquisitions::class)->forProperties([$this->b['property']]));

    expect(L::dans($this->b['org'], fn (): array => app(LoanCosts::class)->trackedProperties(2026)))->toBe([$this->b['property']])
        ->and($lues)->toHaveCount(1)->and($lues[0]->dueOn)->toBe('2026-01-31')->and($lues[0]->payment->getAmount())->toBe('408027')
        ->and($acq)->toHaveCount(1)->and($acq[0]->cost->getAmount())->toBe('20000100');

    $autre = I::bailleur('M. Autre');

    expect(L::dans($autre['org'], fn (): array => app(LoanCosts::class)->deductible(2026)))->toBe([])
        ->and(L::dans($autre['org'], fn (): array => app(Acquisitions::class)->forProperties()))->toBe([]);
});

it('markUsed enregistre l\'usage une seule fois et bloque ensuite l\'annulation', function (): void {
    L::dans($this->b['org'], fn () => app(LoanCosts::class)->markUsed([$this->id], 2025));
    L::dans($this->b['org'], fn () => app(LoanCosts::class)->markUsed([$this->id], 2025));

    expect(DB::table('loan_usages')->where('loan_id', $this->id)->count())->toBe(1);
    $this->postJson(I::url($this->b['org'], "/loans/{$this->id}/void"), ['reason' => 'Erreur', 'lock_version' => 1])->assertConflict()->assertJsonPath('code', 'loan_in_use');
});

it('nombre de requêtes constant pour 1, 10 et 30 prêts', function (): void {
    $compter = function (): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        L::dans($this->b['org'], fn () => app(LoanCosts::class)->deductible(2026));
        $this->getJson(I::url($this->b['org'], '/loans'))->assertOk();

        return count(DB::getQueryLog());
    };

    $un = $compter();
    foreach (range(1, 9) as $i) {
        I::pret($this, $this->b, ['first_due_on' => '2026-01-05'], "bulk-pret-{$i}0000")->assertCreated();
    }
    $dix = $compter();
    foreach (range(10, 29) as $i) {
        I::pret($this, $this->b, ['first_due_on' => '2026-01-05'], "bulk-pret-{$i}0000")->assertCreated();
    }

    expect($compter())->toBe($dix)->and($dix)->toBe($un);
});
