<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Accounting\PublicApi\BankBook;
use App\Modules\Banking\Data\ReconciliationFiguresData;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\LineState;
use App\Modules\Banking\Enums\MatchSide;
use App\Modules\Banking\Models\BankStatement;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Money\Currency;

/**
 * Chiffres de l'état de rapprochement d'un compte à une date de fin de mois :
 * écart inexpliqué = (Δ banque − lignes ignorées − lignes non pointées) − (Δ grand livre − écritures non pointées) − décalage de pointage.
 * Les pointages étant équilibrés, l'écart n'est non nul qu'en cas de trou de relevé ou de solde faux.
 */
final readonly class ReconciliationCalculator
{
    private const ITEMS_MAX = 500;

    private const PAGES_MAX = 200;

    public function __construct(private BankBook $banque, private StatementGaps $trous, private CurrentOrganization $organisation) {}

    public function compute(OrganizationBankAccount $compte, CarbonImmutable $asOf, ?int $soldeSaisi): ReconciliationFiguresData
    {
        $debut = CarbonImmutable::parse($compte->reconciliation_from->toDateString());
        $role = $compte->ledger_role->accountRole();
        $devise = new Currency($compte->currency);
        $ids = ['account' => $compte->id, 'from' => $debut->toDateString(), 'to' => $asOf->toDateString()];

        $somme = $this->sums($compte->id, $debut->toDateString(), $asOf->toDateString());
        [$solde, $source] = $this->bankBalance($compte, $asOf, $soldeSaisi);
        $ouverture = $this->openingReference($compte, $debut);

        $livre = $this->banque->position($role, $devise, $asOf, $debut);
        $solde_livre = $this->banque->position($role, $devise, $asOf, null);
        $pointees = $this->matchedJournalIds($compte->id);
        [$ecrituresNonPointees, $listeEcritures, $tronque] = $this->unmatchedEntries($compte, $debut, $asOf, $pointees);
        $decalage = $this->timing($compte, $debut, $asOf);

        $ecart = ($solde - $ouverture - $somme['ignored'] - $somme['unmatched']) - ((int) $livre->balance->getAmount() - $ecrituresNonPointees) - $decalage;
        $trous = $this->trous->of($compte->id, $asOf);

        $items = [
            'unmatched_lines' => $this->lines($compte->id, $debut->toDateString(), $asOf->toDateString(), LineState::Unmatched),
            'ignored_lines' => $this->lines($compte->id, $debut->toDateString(), $asOf->toDateString(), LineState::Ignored),
            'unmatched_entries' => $listeEcritures,
            'gaps' => array_map(static fn ($t): array => ['previous_statement_id' => $t->previousStatementId, 'statement_id' => $t->statementId, 'expected_opening' => $t->expectedOpening, 'actual_opening' => $t->actualOpening], $trous),
            'truncated' => $tronque,
        ];

        return new ReconciliationFiguresData(
            $source, $solde, (int) $solde_livre->balance->getAmount(), $somme['unmatched'], $ecrituresNonPointees, $somme['ignored'], $decalage, $ecart, $items, $trous,
            hash('sha256', (string) json_encode([$ids, $livre->lineCount, $livre->balance->getAmount(), $somme, $this->matchItemCount($compte->id), $this->statementCount($compte->id)])),
        );
    }

    /**
     * @return array{total: int, unmatched: int, ignored: int, count: int}
     */
    private function sums(string $accountId, string $from, string $to): array
    {
        $lignes = $this->aliveLines($accountId)->whereBetween('l.booking_date', [$from, $to])->groupBy('l.state')
            ->selectRaw("l.state as etat, count(*) as n, coalesce(sum(case when l.direction = 'credit' then l.amount else 0 end), 0) as c, coalesce(sum(case when l.direction = 'debit' then l.amount else 0 end), 0) as d")
            ->get();
        $resultat = ['total' => 0, 'unmatched' => 0, 'ignored' => 0, 'count' => 0];

        foreach ($lignes as $ligne) {
            $signe = (int) $ligne->c - (int) $ligne->d;
            $resultat['total'] += $signe;
            $resultat['count'] += (int) $ligne->n;

            if ($ligne->etat === LineState::Unmatched->value) {
                $resultat['unmatched'] += $signe;
            } elseif ($ligne->etat === LineState::Ignored->value) {
                $resultat['ignored'] += $signe;
            }
        }

        return $resultat;
    }

    /**
     * @return array{0: int, 1: string}
     */
    private function bankBalance(OrganizationBankAccount $compte, CarbonImmutable $asOf, ?int $saisi): array
    {
        $releves = BankStatement::query()->where('bank_account_id', $compte->id)->whereNull('voided_at')->where('is_copy', false);
        $reference = (clone $releves)->whereNotNull('closing_balance')->whereDate('period_to', '<=', $asOf->toDateString())
            ->orderByDesc('period_to')->orderByDesc('period_from')->orderByDesc('created_at')->first();

        if ($reference !== null) {
            $apres = $this->signed($compte->id, $reference->period_to->addDay()->toDateString(), $asOf->toDateString());
            $final = (int) $reference->closing_balance?->getAmount() + $apres;

            return [$final, $apres === 0 && $reference->period_to->toDateString() === $asOf->toDateString() ? 'statement' : 'chained'];
        }

        $premier = (clone $releves)->whereNotNull('opening_balance')->orderBy('period_from')->orderBy('created_at')->first();

        if ($premier !== null) {
            return [(int) $premier->opening_balance?->getAmount() + $this->signed($compte->id, $premier->period_from->toDateString(), $asOf->toDateString()), 'chained'];
        }

        if ($saisi === null) {
            throw ErrorCode::ReconciliationBalanceRequired->problem();
        }

        return [$saisi, 'entered'];
    }

    private function openingReference(OrganizationBankAccount $compte, CarbonImmutable $debut): int
    {
        $premier = BankStatement::query()->where('bank_account_id', $compte->id)->whereNull('voided_at')->where('is_copy', false)->whereNotNull('opening_balance')
            ->orderBy('period_from')->orderBy('created_at')->first();

        if ($premier === null) {
            return (int) $compte->opening_bank_balance->getAmount();
        }

        return (int) $premier->opening_balance?->getAmount() + $this->signed($compte->id, $premier->period_from->toDateString(), $debut->subDay()->toDateString());
    }

    private function signed(string $accountId, string $from, string $to): int
    {
        if ($from > $to) {
            return 0;
        }

        $ligne = $this->aliveLines($accountId)->whereBetween('l.booking_date', [$from, $to])
            ->selectRaw("coalesce(sum(case when l.direction = 'credit' then l.amount else 0 end), 0) as c, coalesce(sum(case when l.direction = 'debit' then l.amount else 0 end), 0) as d")->first();

        return (int) ($ligne->c ?? 0) - (int) ($ligne->d ?? 0);
    }

    private function aliveLines(string $accountId): Builder
    {
        return DB::table('bank_statement_lines as l')
            ->join('bank_statements as s', function ($join): void {
                $join->on('s.id', '=', 'l.statement_id')->on('s.organization_id', '=', 'l.organization_id');
            })
            ->where('l.organization_id', $this->organisation->id())
            ->where('l.bank_account_id', $accountId)->whereNull('s.voided_at');
    }

    /**
     * @return list<array{id: string, direction: string, amount: int}>
     */
    private function lines(string $accountId, string $from, string $to, LineState $etat): array
    {
        $lignes = $this->aliveLines($accountId)->where('l.state', $etat->value)->whereBetween('l.booking_date', [$from, $to])
            ->orderBy('l.booking_date')->orderBy('l.id')->limit(self::ITEMS_MAX)->get(['l.id', 'l.direction', 'l.amount'])
            ->map(static fn ($l): array => ['id' => (string) $l->id, 'direction' => (string) $l->direction, 'amount' => (int) $l->amount])->all();

        return array_values($lignes);
    }

    /**
     * @return array<string, true>
     */
    private function matchedJournalIds(string $accountId): array
    {
        $ids = [];
        $refs = DB::table('bank_match_items as i')->join('bank_matches as m', function ($join): void {
            $join->on('m.id', '=', 'i.match_id')->on('m.organization_id', '=', 'i.organization_id');
        })->where('i.organization_id', $this->organisation->id())
            ->where('m.bank_account_id', $accountId)->whereNull('i.undone_at')->where('i.side', MatchSide::JournalLine->value)->pluck('i.ref_id');

        foreach ($refs as $ref) {
            $ids[(string) $ref] = true;
        }

        return $ids;
    }

    /**
     * @param  array<string, true>  $pointees
     * @return array{0: int, 1: list<array{id: string, side: string, amount: int}>, 2: bool}
     */
    private function unmatchedEntries(OrganizationBankAccount $compte, CarbonImmutable $debut, CarbonImmutable $fin, array $pointees): array
    {
        $role = $compte->ledger_role->accountRole();
        $devise = new Currency($compte->currency);
        $total = 0;
        $liste = [];
        $tronque = false;
        $curseur = null;

        for ($page = 0; $page < self::PAGES_MAX; $page++) {
            $resultat = $this->banque->lines($role, $devise, $debut, $fin, null, null, $curseur, 500);

            foreach ($resultat->lines as $ligne) {
                if (isset($pointees[$ligne->lineId])) {
                    continue;
                }

                $montant = (int) $ligne->amount->getAmount();
                $total += $ligne->side->value === 'debit' ? $montant : -$montant;

                if (count($liste) < self::ITEMS_MAX) {
                    $liste[] = ['id' => $ligne->lineId, 'side' => $ligne->side->value, 'amount' => $montant];
                } else {
                    $tronque = true;
                }
            }

            $curseur = $resultat->nextCursor;

            if ($curseur === null) {
                break;
            }
        }

        return [$total, $liste, $tronque];
    }

    private function timing(OrganizationBankAccount $compte, CarbonImmutable $debut, CarbonImmutable $fin): int
    {
        $role = $compte->ledger_role->accountRole();
        $devise = new Currency($compte->currency);
        $decalage = 0;

        DB::table('bank_match_items as i')->join('bank_matches as m', function ($join): void {
            $join->on('m.id', '=', 'i.match_id')->on('m.organization_id', '=', 'i.organization_id');
        })->where('i.organization_id', $this->organisation->id())
            ->where('m.bank_account_id', $compte->id)->whereNull('i.undone_at')->select(['i.id', 'i.side', 'i.ref_id'])
            ->chunkById((int) config('banking.timing_chunk'), function ($elements) use ($role, $devise, $debut, $fin, &$decalage): void {
                $signes = [];

                foreach ($elements->where('side', MatchSide::StatementLine->value)->pluck('ref_id')->chunk(500) as $lot) {
                    foreach (DB::table('bank_statement_lines')->whereIn('id', $lot->all())->get(['id', 'direction', 'amount', 'booking_date']) as $ligne) {
                        $jour = substr((string) $ligne->booking_date, 0, 10);
                        $signes[(string) $ligne->id] = ($jour >= $debut->toDateString() && $jour <= $fin->toDateString()) ? ($ligne->direction === 'credit' ? 1 : -1) * (int) $ligne->amount : 0;
                    }
                }

                foreach ($elements->where('side', MatchSide::JournalLine->value)->pluck('ref_id')->chunk(500) as $lot) {
                    foreach ($this->banque->find($role, $devise, array_values(array_map(static fn ($id): string => (string) $id, $lot->all()))) as $id => $ligne) {
                        $signes[$id] = ($ligne->entryDate >= $debut->toDateString() && $ligne->entryDate <= $fin->toDateString()) ? ($ligne->side->value === 'debit' ? 1 : -1) * (int) $ligne->amount->getAmount() : 0;
                    }
                }

                foreach ($elements as $element) {
                    $valeur = $signes[(string) $element->ref_id] ?? 0;
                    $decalage += $element->side === MatchSide::StatementLine->value ? $valeur : -$valeur;
                }
            }, 'i.id', 'id');

        return $decalage;
    }

    private function matchItemCount(string $accountId): int
    {
        return DB::table('bank_match_items as i')->join('bank_matches as m', function ($join): void {
            $join->on('m.id', '=', 'i.match_id')->on('m.organization_id', '=', 'i.organization_id');
        })->where('i.organization_id', $this->organisation->id())->where('m.bank_account_id', $accountId)->whereNull('i.undone_at')->count();
    }

    private function statementCount(string $accountId): int
    {
        return BankStatement::query()->where('bank_account_id', $accountId)->whereNull('voided_at')->count();
    }
}
