<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Charges\Data\ChargeAnomalyData;
use App\Modules\Charges\Enums\AnomalyKind;
use App\Modules\Charges\Enums\ExerciseStatus;
use App\Modules\Charges\Enums\ExpenseSettlement;
use App\Modules\Charges\Enums\ExpenseStatus;
use App\Modules\Charges\Enums\SourceKind;
use App\Modules\Charges\Enums\StatementSettlement;
use App\Modules\Charges\Enums\StatementStatus;
use App\Modules\Maintenance\PublicApi\SupplierInvoiceDirectory;
use App\Modules\Rent\PublicApi\RentAdjustments;
use Illuminate\Support\Facades\DB;

/**
 * Contrôles de cohérence d'une organisation (ADR 0034 § 11) : ils signalent, ils ne corrigent jamais. Lecture directe des tables du module,
 * bornée par l'organisation ; le grand livre et Rent se lisent par leur PublicApi.
 */
final readonly class AnomalyChecks
{
    private const int LOT = 500;

    public function __construct(
        private RentAdjustments $rent,
        private LedgerReader $livre,
        private SupplierInvoiceDirectory $factures,
        private RectificationCumuls $rectifications,
    ) {}

    /**
     * @return list<ChargeAnomalyData>
     */
    public function of(string $organizationId): array
    {
        return [
            ...$this->items($organizationId),
            ...$this->statements($organizationId),
            ...$this->sources($organizationId),
            ...$this->effects($organizationId),
            ...$this->expenses($organizationId),
        ];
    }

    /**
     * Somme des parts des locataires au plus égale au poste : le reste est la part du propriétaire.
     *
     * @return list<ChargeAnomalyData>
     */
    private function items(string $org): array
    {
        $parts = DB::table('charge_statement_lines as l')
            ->join('charge_statements as s', 's.id', '=', 'l.statement_id')
            ->where('s.organization_id', $org)
            ->whereIn('s.status', [StatementStatus::Computed->value, StatementStatus::Issued->value])
            ->groupBy('l.item_id')
            ->selectRaw('l.item_id as item_id, SUM(l.share) as total')
            ->pluck('total', 'item_id');
        $anomalies = [];

        foreach (array_chunk($parts->keys()->all(), self::LOT) as $lot) {
            foreach (DB::table('charge_items')->where('organization_id', $org)->whereIn('id', $lot)->pluck('amount', 'id') as $id => $montant) {
                if ((int) $parts[$id] > (int) $montant) {
                    $anomalies[] = new ChargeAnomalyData(AnomalyKind::ItemOvershare, $org, (string) $id, sprintf('Les parts (%d) dépassent le poste (%d).', $parts[$id], $montant));
                }
            }
        }

        return $anomalies;
    }

    /**
     * @return list<ChargeAnomalyData>
     */
    private function statements(string $org): array
    {
        $anomalies = [];
        $statuts = [StatementStatus::Computed->value, StatementStatus::Issued->value, StatementStatus::Superseded->value];

        DB::table('charge_statements')->where('organization_id', $org)->whereIn('status', $statuts)->orderBy('id')->chunk(self::LOT, function ($lot) use ($org, &$anomalies): void {
            $sommes = DB::table('charge_statement_lines')->where('organization_id', $org)->whereIn('statement_id', $lot->pluck('id')->all())->groupBy('statement_id')
                ->selectRaw('statement_id, SUM(share) as total')->pluck('total', 'statement_id');

            foreach ($lot as $d) {
                if ((int) ($sommes[$d->id] ?? 0) !== (int) $d->share_total) {
                    $anomalies[] = new ChargeAnomalyData(AnomalyKind::StatementTotalMismatch, $org, $d->id, 'Le total du décompte ne vaut pas la somme de ses lignes.');
                }

                if ((int) $d->balance !== (int) $d->share_total - (int) $d->provisions_called) {
                    $anomalies[] = new ChargeAnomalyData(AnomalyKind::StatementBalanceMismatch, $org, $d->id, 'Le solde du décompte ne vaut pas le total moins les provisions appelées.');
                }
            }
        });

        return $anomalies;
    }

    /**
     * Cumul des exercices non écartés au plus égal à la part récupérable de la source ; un rectificatif ne compte pas pour les autres, mais son propre cumul
     * (ce qu'il retient plus les exercices d'origine autres que celui de son décompte rectifié) l'est aussi.
     *
     * @return list<ChargeAnomalyData>
     */
    private function sources(string $org): array
    {
        $cumuls = DB::table('charge_item_sources as s')
            ->join('charge_exercises as e', 'e.id', '=', 's.exercise_id')
            ->where('s.organization_id', $org)->where('e.status', '<>', ExerciseStatus::Discarded->value)->whereNull('e.only_lease_id')
            ->groupBy('s.source_kind', 's.source_id')
            ->selectRaw('s.source_kind as kind, s.source_id as id, SUM(s.amount) as total')->get()
            ->concat($this->rectifications->of($org));
        $anomalies = [];

        foreach ([SourceKind::Expense, SourceKind::SupplierInvoice] as $genre) {
            $lignes = $cumuls->where('kind', $genre->value)->values();

            foreach ($lignes->chunk(self::LOT) as $lot) {
                $ids = array_values(array_map(strval(...), $lot->pluck('id')->all()));
                $plafonds = $genre === SourceKind::Expense
                    ? DB::table('expenses')->where('organization_id', $org)->where('status', ExpenseStatus::Recorded->value)->whereIn('id', $ids)->pluck('recoverable_amount', 'id')->map(fn (mixed $v): int => (int) $v)->all()
                    : $this->invoiceCaps($ids);

                foreach ($lot as $ligne) {
                    if ((int) $ligne->total > ($plafonds[$ligne->id] ?? 0)) {
                        $anomalies[] = new ChargeAnomalyData(AnomalyKind::SourceOvercap, $org, (string) $ligne->id, sprintf('Cumul retenu (%d) au-delà de la part récupérable de la source (%s).', $ligne->total, $genre->value));
                    }
                }
            }
        }

        return $anomalies;
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, int>
     */
    private function invoiceCaps(array $ids): array
    {
        $plafonds = [];

        foreach ($this->factures->ownerShares($ids) as $part) {
            $plafonds[$part->invoiceId] = (int) $part->ownerShare->getAmount();
        }

        return $plafonds;
    }

    /**
     * Un décompte émis qui doit solder une différence a sa ligne en attente, son échéance ponctuelle ou son crédit.
     *
     * @return list<ChargeAnomalyData>
     */
    private function effects(string $org): array
    {
        $attendus = DB::table('charge_statements')->where('organization_id', $org)->whereIn('status', [StatementStatus::Issued->value, StatementStatus::Superseded->value])
            ->whereIn('settlement', [StatementSettlement::NextInstallments->value, StatementSettlement::StandaloneInstallment->value, StatementSettlement::Credit->value])
            ->pluck('id')->map(fn (mixed $id): string => (string) $id)->all();
        $anomalies = [];

        foreach (array_chunk($attendus, self::LOT) as $lot) {
            foreach (array_diff($lot, $this->rent->statementsWithEffect($lot)) as $id) {
                $anomalies[] = new ChargeAnomalyData(AnomalyKind::StatementEffectMissing, $org, $id, 'Décompte émis sans ligne de régularisation ni crédit dans le compte du locataire.');
            }
        }

        return $anomalies;
    }

    /**
     * Une dépense comptabilisée a une écriture dont le total vaut son montant ; une dépense annulée a sa contrepassation ; un mode sans écriture n'en a pas.
     *
     * @return list<ChargeAnomalyData>
     */
    private function expenses(string $org): array
    {
        $anomalies = [];

        DB::table('expenses')->where('organization_id', $org)->orderBy('id')->chunk(self::LOT, function ($lot) use ($org, &$anomalies): void {
            $totaux = $this->livre->entryDebitTotals(array_values(array_map(strval(...), $lot->pluck('ledger_entry_id')->filter()->all())));

            foreach ($lot as $d) {
                $ecrit = ExpenseSettlement::from($d->settlement)->postsToLedger() && $d->status !== ExpenseStatus::PendingApproval->value;
                $probleme = match (true) {
                    ! $ecrit => $d->ledger_entry_id !== null || $d->cancellation_entry_id !== null,
                    $d->ledger_entry_id === null => true,
                    ($totaux[$d->ledger_entry_id] ?? null) !== (int) $d->total_gross => true,
                    default => ($d->status === ExpenseStatus::Cancelled->value) !== ($d->cancellation_entry_id !== null),
                };

                if ($probleme) {
                    $anomalies[] = new ChargeAnomalyData(AnomalyKind::ExpenseEntryMismatch, $org, $d->id, 'La dépense et son écriture comptable ne concordent pas.');
                }
            }
        });

        return $anomalies;
    }
}
