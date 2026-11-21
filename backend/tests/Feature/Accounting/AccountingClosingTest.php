<?php

declare(strict_types=1);

require_once __DIR__.'/helpers.php';

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Enums\OnClosedPeriod;
use App\Modules\Accounting\Models\AccountingPeriod;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Money;

function codeCloture(Closure $action): string
{
    try {
        $action();
    } catch (ApiProblem $probleme) {
        return $probleme->problemCode;
    }

    return 'aucune erreur';
}

function clore(object $org, string $mois, string $aujourdhui = '2026-12-20', array $motifs = []): mixed
{
    return comptaDans($org, fn () => app(Ledger::class)->closeMonth(CarbonImmutable::parse($mois.'-01'), null, fn (): array => $motifs, CarbonImmutable::parse($aujourdhui)));
}

beforeEach(function (): void {
    $this->org = comptaOrganisation();
    comptaPoster($this->org, comptaLoyer('close-loyer-oct', Money::EUR(65000), '2026-10-05'));
});

it('clôt le plus ancien mois et le renvoie tel quel au rejeu', function (): void {
    $periode = clore($this->org, '2026-10');
    $rejeu = clore($this->org, '2026-10');

    expect($periode->start->toDateString())->toBe('2026-10-01')
        ->and($periode->end->toDateString())->toBe('2026-11-01')
        ->and($rejeu->id)->toBe($periode->id)
        ->and(comptaDans($this->org, fn () => AccountingPeriod::query()->count()))->toBe(1);
});

it('refuse un mois non terminé, hors ordre, ou qu\'un motif de l\'appelant bloque', function (): void {
    expect(codeCloture(fn () => clore($this->org, '2026-10', '2026-10-20')))->toBe('accounting_period_not_closable')
        ->and(codeCloture(fn () => clore($this->org, '2026-11')))->toBe('accounting_period_order')
        ->and(codeCloture(fn () => clore($this->org, '2026-10', '2026-12-20', ['trust_funds_gap'])))->toBe('accounting_period_not_closable')
        ->and(comptaDans($this->org, fn () => AccountingPeriod::query()->count()))->toBe(0);
});

it('une écriture rétroactive dans un mois clos est refusée, et la date reportée sur le premier jour ouvert si l\'appelant l\'accepte', function (): void {
    clore($this->org, '2026-10');

    expect(codeCloture(fn () => comptaPoster($this->org, comptaLoyer('retro-1', Money::EUR(100), '2026-10-20'))))->toBe('accounting_period_closed');

    $reportee = comptaPoster($this->org, new EntryData(...[...get_object_vars(comptaLoyer('retro-2', Money::EUR(100), '2026-10-20')), 'onClosedPeriod' => OnClosedPeriod::RollForward]));
    $date = comptaDans($this->org, fn () => JournalEntry::query()->whereKey($reportee->id)->value('entry_date'));

    expect(substr((string) $date, 0, 10))->toBe('2026-11-01');
});

it('un déclencheur en base refuse l\'insertion datée d\'un mois clos et toute modification d\'une période', function (): void {
    $periode = clore($this->org, '2026-10');
    $entree = comptaDans($this->org, fn () => JournalEntry::query()->firstOrFail());

    expect(fn () => comptaDans($this->org, fn () => DB::table('journal_entries')->insert([
        'id' => (string) Str::uuid7(), 'organization_id' => $this->org->id, 'entry_date' => '2026-10-31', 'journal' => 'rent',
        'label' => 'x', 'source_type' => $entree->source_type->value, 'source_id' => (string) Str::uuid7(),
        'idempotency_key' => 'trigger-close', 'created_at' => now(), 'updated_at' => now(),
    ])))->toThrow(QueryException::class)
        ->and(fn () => comptaDans($this->org, fn () => DB::table('accounting_periods')->where('id', $periode->id)->update(['closed_by_user_id' => null])))->toThrow(QueryException::class, 'ajout seul')
        ->and(fn () => comptaDans($this->org, fn () => DB::table('accounting_periods')->where('id', $periode->id)->delete()))->toThrow(QueryException::class, 'ajout seul');
});

it('les agrégats exposent les mois clos et le premier jour ouvert', function (): void {
    clore($this->org, '2026-10');
    $agregats = comptaDans($this->org, fn () => app(LedgerAggregates::class));

    expect(comptaDans($this->org, fn () => $agregats->firstOpenDay()?->toDateString()))->toBe('2026-11-01')
        ->and(comptaDans($this->org, fn () => $agregats->isClosed(CarbonImmutable::parse('2026-10-15'))))->toBeTrue()
        ->and(comptaDans($this->org, fn () => $agregats->isClosed(CarbonImmutable::parse('2026-11-15'))))->toBeFalse()
        ->and(comptaDans($this->org, fn () => count($agregats->periods())))->toBe(1);
});

it('la clôture d\'une organisation n\'en touche aucune autre', function (): void {
    $autre = comptaOrganisation();
    comptaPoster($autre, comptaLoyer('autre-loyer', Money::EUR(100), '2026-10-05'));
    clore($this->org, '2026-10');

    expect(comptaDans($autre, fn () => AccountingPeriod::query()->count()))->toBe(0)
        ->and(codeCloture(fn () => comptaPoster($autre, comptaLoyer('autre-2', Money::EUR(100), '2026-10-20'))))->toBe('aucune erreur');
});
