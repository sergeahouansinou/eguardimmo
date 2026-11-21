<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Actions;

use App\Modules\Accounting\Data\AccountingPeriodData;
use App\Modules\Accounting\Enums\ErrorCode;
use App\Modules\Accounting\Models\AccountingPeriod;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Queries\Aggregates;
use App\Modules\Accounting\Queries\LedgerAnomalies;
use App\Modules\Accounting\Support\Periods;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Support\Facades\DB;

final readonly class CloseMonth
{
    public function __construct(
        private Periods $periodes,
        private Aggregates $agregats,
        private LedgerAnomalies $anomalies,
        private CurrentOrganization $contexte,
        private RecordAudit $audit,
    ) {}

    /**
     * Clôt le plus ancien mois ouvert, sous le verrou exclusif des périodes : les contrôles de l'appelant se jouent
     * donc sur un grand livre que plus aucune écriture ne peut changer. Rejouable : un mois déjà clos est renvoyé.
     *
     * @param  Closure(): list<string>  $blockers  motifs de refus propres à l'appelant, lus sous le verrou
     */
    public function handle(CarbonImmutable $month, ?string $userId, Closure $blockers, CarbonImmutable $today): AccountingPeriodData
    {
        return DB::transaction(function () use ($month, $userId, $blockers, $today): AccountingPeriodData {
            $this->periodes->lock(true);
            $debut = $month->startOfMonth()->startOfDay();
            $existante = AccountingPeriod::query()->where('period_start', $debut->toDateString())->first();

            if ($existante !== null) {
                return $this->data($existante, true);
            }

            $attendu = $this->periodes->firstOpenDay() ?? $this->premierMois();

            if ($attendu === null || ! $debut->equalTo($attendu)) {
                throw ErrorCode::PeriodOrder->problem();
            }

            $fin = $debut->addMonth();
            $motifs = $fin->greaterThan($today) ? ['month_not_over'] : [];

            if ($this->anomalies->find($this->contexte->id()) !== []) {
                $motifs[] = 'ledger_anomaly';
            }

            $motifs = [...$motifs, ...$blockers()];

            if ($motifs !== []) {
                throw ErrorCode::PeriodNotClosable->problem('Motifs : '.implode(', ', $motifs).'.');
            }

            $periode = AccountingPeriod::query()->create([
                'period_start' => $debut->toDateString(),
                'period_end' => $fin->toDateString(),
                'closed_at' => now(),
                'closed_by_user_id' => $userId,
                'closing_cutoff' => ['version' => $this->agregats->version()],
            ]);
            $this->audit->handle('accounting.period.closed', subject: $periode, metadata: ['period_start' => $debut->toDateString()]);

            return $this->data($periode, false);
        });
    }

    private function premierMois(): ?CarbonImmutable
    {
        $plusAncienne = JournalEntry::query()->min('entry_date');

        return is_string($plusAncienne) ? CarbonImmutable::parse($plusAncienne)->startOfMonth() : null;
    }

    private function data(AccountingPeriod $periode, bool $rejeu): AccountingPeriodData
    {
        return new AccountingPeriodData(
            $periode->id,
            CarbonImmutable::parse($periode->period_start->toDateString()),
            CarbonImmutable::parse($periode->period_end->toDateString()),
            CarbonImmutable::instance($periode->closed_at),
            $periode->closed_by_user_id,
            (string) ($periode->closing_cutoff['version'] ?? ''),
            $rejeu,
        );
    }
}
