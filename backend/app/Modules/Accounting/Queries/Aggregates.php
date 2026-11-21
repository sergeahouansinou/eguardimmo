<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Queries;

use App\Modules\Accounting\Data\AccountingPeriodData;
use App\Modules\Accounting\Data\CollectionMovementData;
use App\Modules\Accounting\Data\OwnerFundsBalanceData;
use App\Modules\Accounting\Data\TrustCoverageData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\Side;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AccountingPeriod;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Models\JournalLine;
use App\Modules\Accounting\Support\MoneyColumns;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Money\Currency;
use Money\Money;

/**
 * Agrégats du grand livre pour les modules de gestion (ADR 0031) : soldes par mandant, encaissements imputés par lot et
 * par jour, équation de cantonnement. Toujours lus dans le grand livre de l'organisation courante.
 */
final class Aggregates
{
    private const array APPELES = [AccountRole::OwnerRentCalled, AccountRole::OwnerChargesCalled, AccountRole::OwnerVatCalled];

    /**
     * @return list<AccountingPeriodData>
     */
    public function periods(): array
    {
        return array_values(AccountingPeriod::query()->orderBy('period_start')->get()->map(fn (AccountingPeriod $p): AccountingPeriodData => new AccountingPeriodData(
            $p->id, CarbonImmutable::parse($p->period_start->toDateString()), CarbonImmutable::parse($p->period_end->toDateString()),
            CarbonImmutable::instance($p->closed_at), $p->closed_by_user_id, (string) ($p->closing_cutoff['version'] ?? ''), false,
        ))->all());
    }

    /**
     * Organisations dont les fonds des mandants sont actifs : lecture de plateforme, hors contexte d'organisation.
     *
     * @return list<string>
     */
    public function organizationsWithOwnerFunds(): array
    {
        return array_values(array_map('strval', DB::table('accounting_settings')->whereNotNull('owner_funds_cutover_at')->orderBy('organization_id')->pluck('organization_id')->all()));
    }

    public function firstOpenDay(): ?CarbonImmutable
    {
        $fin = AccountingPeriod::query()->max('period_end');

        return is_string($fin) ? CarbonImmutable::parse($fin) : null;
    }

    public function isClosed(CarbonImmutable $monthStart): bool
    {
        return AccountingPeriod::query()->where('period_start', $monthStart->startOfMonth()->toDateString())->exists();
    }

    public function version(): string
    {
        $derniere = JournalEntry::query()->orderByDesc('fiscal_year')->orderByDesc('number')->first(['id']);

        return JournalEntry::query()->count().':'.($derniere->id ?? '-');
    }

    /**
     * @param  list<string>|null  $partyIds
     * @return array<string, OwnerFundsBalanceData> par mandant ; un mandant sans écriture vaut zéro
     */
    public function ownerFunds(?array $partyIds, Currency $currency, ?CarbonImmutable $asOf): array
    {
        $roles = [AccountRole::OwnerPayable, AccountRole::PayoutsInTransit, ...self::APPELES];
        $zero = new Money(0, $currency);
        $resultat = [];

        foreach ($partyIds ?? [] as $id) {
            $resultat[$id] = new OwnerFundsBalanceData($id, $zero, $zero, $zero);
        }

        foreach ($this->parPartie($roles, $currency, $asOf, $partyIds) as $partie => $soldes) {
            $appele = $zero;

            foreach (self::APPELES as $role) {
                $appele = $appele->add($soldes[$role->value] ?? $zero);
            }

            $resultat[$partie] = new OwnerFundsBalanceData($partie, $soldes[AccountRole::OwnerPayable->value] ?? $zero, $soldes[AccountRole::PayoutsInTransit->value] ?? $zero, $appele);
        }

        return $resultat;
    }

    /**
     * Encaissements imputés sur les comptes « appelés » : les écritures d'appel et leurs contrepassations sont exclues,
     * les contrepassations d'un encaissement viennent en déduction.
     *
     * @param  list<AccountRole>  $roles
     * @return list<CollectionMovementData>
     */
    public function collections(array $roles, Currency $currency, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $comptes = Account::query()->whereIn('role', array_map(fn (AccountRole $r): string => $r->value, $roles))->pluck('role', 'id')->all();
        $lignes = JournalLine::query()
            ->join('journal_entries as e', fn ($j) => $j->on('e.id', '=', 'journal_lines.journal_entry_id')->on('e.organization_id', '=', 'journal_lines.organization_id'))
            ->leftJoin('journal_entries as o', fn ($j) => $j->on('o.id', '=', 'e.reversal_of_id')->on('o.organization_id', '=', 'e.organization_id'))
            ->whereIn('journal_lines.account_id', array_keys($comptes))
            ->where('journal_lines.currency', $currency->getCode())
            ->where('e.entry_date', '>=', $from->format('Y-m-d'))->where('e.entry_date', '<', $to->addDay()->format('Y-m-d'))
            ->where(fn ($q) => $q->where('e.source_type', '<>', 'installment')->where('e.idempotency_key', 'not like', 'owner_funds:backfill:%:call'))
            ->where(fn ($q) => $q->whereNull('o.id')->orWhere(fn ($s) => $s->where('o.source_type', '<>', 'installment')->where('o.idempotency_key', 'not like', 'owner_funds:backfill:%:call')))
            ->selectRaw('journal_lines.party_id as party_id, journal_lines.unit_id as unit_id, e.entry_date as entry_date, journal_lines.account_id as account_id, sum(journal_lines.debit) as debit, sum(journal_lines.credit) as credit')
            ->groupBy('journal_lines.party_id', 'journal_lines.unit_id', 'e.entry_date', 'journal_lines.account_id')
            ->orderBy('e.entry_date')
            ->toBase()->get();
        $mouvements = [];

        foreach ($lignes as $ligne) {
            $net = MoneyColumns::money($ligne->debit, $currency)->subtract(MoneyColumns::money($ligne->credit, $currency));

            if ($net->isZero() || ! is_string($ligne->party_id)) {
                continue;
            }

            $mouvements[] = new CollectionMovementData($ligne->party_id, is_string($ligne->unit_id) ? $ligne->unit_id : null, substr((string) $ligne->entry_date, 0, 10), $comptes[(string) $ligne->account_id], $net);
        }

        return $mouvements;
    }

    public function trust(Currency $currency, ?CarbonImmutable $asOf): TrustCoverageData
    {
        $zero = new Money(0, $currency);
        $banque = $this->solde(AccountRole::TrustBank, $currency, $asOf, null);
        $transit = $zero;
        $dettes = $zero;

        foreach ($this->parPartie([AccountRole::OwnerPayable, AccountRole::PayoutsInTransit], $currency, $asOf, null) as $soldes) {
            $dette = $soldes[AccountRole::OwnerPayable->value] ?? $zero;
            $dettes = $dette->isPositive() ? $dettes->add($dette) : $dettes;
            $enCours = $soldes[AccountRole::PayoutsInTransit->value] ?? $zero;
            $transit = $enCours->isPositive() ? $transit->add($enCours) : $transit;
        }

        $baux = JournalLine::query()->whereIn('account_id', $this->ids(self::APPELES))->whereNotNull('lease_id')->select('lease_id');
        $depots = $this->solde(AccountRole::SecurityDeposits, $currency, $asOf, $baux);
        $avances = $this->avances($currency, $asOf, $baux);
        $requis = $dettes->add($transit)->add($depots->isPositive() ? $depots : $zero)->add($avances->isPositive() ? $avances : $zero);
        $surplus = $banque->subtract($requis);

        return new TrustCoverageData($banque, $dettes, $transit, $depots->isPositive() ? $depots : $zero, $avances->isPositive() ? $avances : $zero, $requis, $surplus, ! $surplus->isNegative());
    }

    /**
     * @param  list<AccountRole>  $roles
     * @param  list<string>|null  $partyIds
     * @return array<string, array<string, Money>> soldes dans le sens normal, par partie puis par rôle
     */
    private function parPartie(array $roles, Currency $currency, ?CarbonImmutable $asOf, ?array $partyIds): array
    {
        $comptes = Account::query()->whereIn('role', array_map(fn (AccountRole $r): string => $r->value, $roles))->pluck('role', 'id')->all();
        $requete = $this->lignes($currency)->whereIn('journal_lines.account_id', array_keys($comptes))->whereNotNull('journal_lines.party_id');

        if ($partyIds !== null) {
            $requete->whereIn('journal_lines.party_id', $partyIds);
        }

        if ($asOf !== null) {
            $requete->where('e.entry_date', '<', $asOf->addDay()->format('Y-m-d'));
        }

        $lues = $requete->selectRaw('journal_lines.party_id as party_id, journal_lines.account_id as account_id, sum(journal_lines.debit) as debit, sum(journal_lines.credit) as credit')
            ->groupBy('journal_lines.party_id', 'journal_lines.account_id')->toBase()->get();
        $soldes = [];

        foreach ($lues as $ligne) {
            $role = $comptes[(string) $ligne->account_id];
            $debit = MoneyColumns::money($ligne->debit, $currency);
            $credit = MoneyColumns::money($ligne->credit, $currency);
            $soldes[(string) $ligne->party_id][$role->value] = $role->normalSide() === Side::Debit ? $debit->subtract($credit) : $credit->subtract($debit);
        }

        return $soldes;
    }

    /**
     * @param  Builder<JournalLine>|null  $baux  restreint aux baux qui portent un appel pour le compte d'un mandant
     */
    private function solde(AccountRole $role, Currency $currency, ?CarbonImmutable $asOf, ?Builder $baux): Money
    {
        $requete = $this->lignes($currency)->whereIn('journal_lines.account_id', $this->ids([$role]));

        if ($baux !== null) {
            $requete->whereIn('journal_lines.lease_id', $baux->toBase());
        }

        if ($asOf !== null) {
            $requete->where('e.entry_date', '<', $asOf->addDay()->format('Y-m-d'));
        }

        $somme = $requete->selectRaw('coalesce(sum(journal_lines.debit), 0) as debit, coalesce(sum(journal_lines.credit), 0) as credit')->toBase()->first();
        $debit = MoneyColumns::money($somme->debit ?? 0, $currency);
        $credit = MoneyColumns::money($somme->credit ?? 0, $currency);

        return $role->normalSide() === Side::Debit ? $debit->subtract($credit) : $credit->subtract($debit);
    }

    /**
     * Trop-perçus des baux sous mandat : crédits du compte locataire sans créance, nets des imputations.
     *
     * @param  Builder<JournalLine>  $baux
     */
    private function avances(Currency $currency, ?CarbonImmutable $asOf, Builder $baux): Money
    {
        $requete = $this->lignes($currency)->whereIn('journal_lines.account_id', $this->ids([AccountRole::TenantReceivable]))
            ->whereNull('journal_lines.item_id')->whereIn('journal_lines.lease_id', $baux->toBase());

        if ($asOf !== null) {
            $requete->where('e.entry_date', '<', $asOf->addDay()->format('Y-m-d'));
        }

        $somme = $requete->selectRaw('coalesce(sum(journal_lines.debit), 0) as debit, coalesce(sum(journal_lines.credit), 0) as credit')->toBase()->first();

        return MoneyColumns::money($somme->credit ?? 0, $currency)->subtract(MoneyColumns::money($somme->debit ?? 0, $currency));
    }

    /**
     * @param  list<AccountRole>  $roles
     * @return list<string>
     */
    private function ids(array $roles): array
    {
        return array_values(array_map('strval', Account::query()->whereIn('role', array_map(fn (AccountRole $r): string => $r->value, $roles))->pluck('id')->all()));
    }

    /**
     * @return Builder<JournalLine>
     */
    private function lignes(Currency $currency): Builder
    {
        return JournalLine::query()
            ->join('journal_entries as e', fn ($j) => $j->on('e.id', '=', 'journal_lines.journal_entry_id')->on('e.organization_id', '=', 'journal_lines.organization_id'))
            ->where('journal_lines.currency', $currency->getCode());
    }
}
