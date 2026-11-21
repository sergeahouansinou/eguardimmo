<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Queries;

use App\Modules\Accounting\Data\LeaseStatementData;
use App\Modules\Accounting\Data\StatementLineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ErrorCode;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\Side;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\JournalLine;
use App\Modules\Accounting\Support\MoneyColumns;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Money\Currency;
use Money\Money;

final class Balances
{
    public const RELEVE_LIGNES_MAX = 1000;

    private const array CREANCES = [AccountRole::TenantReceivable, AccountRole::CustomerReceivable];

    public function account(AccountRole $role, Currency $currency, ?CarbonImmutable $asOf): Money
    {
        return $this->solde($this->lignes($currency, $role), $currency, $role->normalSide(), $asOf);
    }

    public function receivable(string $colonne, string $valeur, Currency $currency, ?CarbonImmutable $asOf): Money
    {
        $role = AccountRole::TenantReceivable;

        return $this->solde($this->lignes($currency, $role)->where("journal_lines.{$colonne}", $valeur), $currency, $role->normalSide(), $asOf);
    }

    public function item(ItemType $type, string $id, Currency $currency, ?CarbonImmutable $asOf): Money
    {
        return $this->solde(
            $this->lignes($currency, ...self::CREANCES)->where('journal_lines.item_type', $type->value)->where('journal_lines.item_id', $id),
            $currency,
            Side::Debit,
            $asOf,
        );
    }

    /**
     * Solde d'un compte pour une pièce précise (facture reçue d'un prestataire), dans le sens normal du compte.
     */
    public function itemOn(AccountRole $role, ItemType $type, string $id, Currency $currency, ?CarbonImmutable $asOf): Money
    {
        return $this->solde(
            $this->lignes($currency, $role)->where('journal_lines.item_type', $type->value)->where('journal_lines.item_id', $id),
            $currency,
            $role->normalSide(),
            $asOf,
        );
    }

    /**
     * Solde d'un compte sur les lignes d'un bail (dépôt de garantie).
     */
    public function accountOnLease(AccountRole $role, string $leaseId, Currency $currency, ?CarbonImmutable $asOf): Money
    {
        return $this->solde($this->lignes($currency, $role)->where('journal_lines.lease_id', $leaseId), $currency, $role->normalSide(), $asOf);
    }

    public function accountOnParty(AccountRole $role, string $partyId, Currency $currency, ?CarbonImmutable $asOf): Money
    {
        return $this->solde($this->lignes($currency, $role)->where('journal_lines.party_id', $partyId), $currency, $role->normalSide(), $asOf);
    }

    /**
     * TVA encore différée d'une créance : crédit moins débit des lignes `VatDeferred` qui la référencent.
     */
    public function deferredVat(ItemType $type, string $id, Currency $currency, ?CarbonImmutable $asOf): Money
    {
        $role = AccountRole::VatDeferred;

        return $this->solde(
            $this->lignes($currency, $role)->where('journal_lines.item_type', $type->value)->where('journal_lines.item_id', $id),
            $currency,
            $role->normalSide(),
            $asOf,
        );
    }

    /**
     * Reste dû de plusieurs créances d'un même type en une requête ; une créance sans écriture vaut zéro.
     *
     * @param  list<string>  $ids
     * @return array<string, Money> par identifiant de créance
     */
    public function items(ItemType $type, array $ids, Currency $currency, ?CarbonImmutable $asOf): array
    {
        $soldes = [];

        foreach ($ids as $id) {
            $soldes[$id] = new Money(0, $currency);
        }

        foreach (array_chunk(array_values(array_unique($ids)), 500) as $lot) {
            $lignes = $this->lignes($currency, ...self::CREANCES)
                ->where('journal_lines.item_type', $type->value)
                ->whereIn('journal_lines.item_id', $lot);

            if ($asOf !== null) {
                $lignes->where('journal_entries.entry_date', '<', $asOf->addDay()->format('Y-m-d'));
            }

            $lues = $lignes
                ->selectRaw('journal_lines.item_id as item_id, coalesce(sum(journal_lines.debit), 0) as debit, coalesce(sum(journal_lines.credit), 0) as credit')
                ->groupBy('journal_lines.item_id')
                ->toBase()->get();

            foreach ($lues as $ligne) {
                $soldes[(string) $ligne->item_id] = MoneyColumns::money($ligne->debit, $currency)->subtract(MoneyColumns::money($ligne->credit, $currency));
            }
        }

        return $soldes;
    }

    public function statement(string $leaseId, Currency $currency, CarbonImmutable $from, CarbonImmutable $to): LeaseStatementData
    {
        $role = AccountRole::TenantReceivable;
        $ouverture = $this->solde(
            $this->lignes($currency, $role)->where('journal_lines.lease_id', $leaseId),
            $currency,
            $role->normalSide(),
            null,
            avant: $from,
        );

        $lignes = [];
        $courant = $ouverture;

        $rows = $this->lignes($currency, $role)
            ->where('journal_lines.lease_id', $leaseId)
            ->where('journal_entries.entry_date', '>=', $from->format('Y-m-d'))
            ->where('journal_entries.entry_date', '<', $to->addDay()->format('Y-m-d'))
            ->orderBy('journal_entries.entry_date')->orderBy('journal_entries.fiscal_year')->orderBy('journal_entries.number')->orderBy('journal_lines.position')
            ->select([
                'journal_lines.debit', 'journal_lines.credit',
                'journal_entries.id as entry_id', 'journal_entries.fiscal_year', 'journal_entries.number',
                'journal_entries.journal', 'journal_entries.entry_date', 'journal_entries.label',
            ])
            ->limit(self::RELEVE_LIGNES_MAX + 1)
            ->toBase()->get();

        if ($rows->count() > self::RELEVE_LIGNES_MAX) {
            throw ErrorCode::StatementTooLong->problem();
        }

        foreach ($rows as $row) {
            $debit = MoneyColumns::money($row->debit, $currency);
            $credit = MoneyColumns::money($row->credit, $currency);
            $courant = $courant->add($debit)->subtract($credit);
            $lignes[] = new StatementLineData(
                entryId: (string) $row->entry_id,
                reference: sprintf('%d-%06d', $row->fiscal_year, $row->number),
                date: CarbonImmutable::parse((string) $row->entry_date),
                journal: Journal::from((string) $row->journal),
                label: (string) $row->label,
                debit: $debit,
                credit: $credit,
                balance: $courant,
            );
        }

        return new LeaseStatementData($leaseId, $from, $to, $ouverture, $lignes, $courant);
    }

    /**
     * @return Builder<JournalLine>
     */
    private function lignes(Currency $currency, AccountRole ...$roles): Builder
    {
        return JournalLine::query()
            ->join('journal_entries', function ($jointure): void {
                $jointure->on('journal_entries.id', '=', 'journal_lines.journal_entry_id')
                    ->on('journal_entries.organization_id', '=', 'journal_lines.organization_id');
            })
            ->whereIn('journal_lines.account_id', Account::query()->whereIn('role', array_map(fn (AccountRole $role): string => $role->value, $roles))->select('id'))
            ->where('journal_lines.currency', $currency->getCode());
    }

    /**
     * @param  Builder<JournalLine>  $lignes
     */
    private function solde(Builder $lignes, Currency $currency, Side $sensNormal, ?CarbonImmutable $asOf, ?CarbonImmutable $avant = null): Money
    {
        if ($asOf !== null) {
            $lignes->where('journal_entries.entry_date', '<', $asOf->addDay()->format('Y-m-d'));
        }

        if ($avant !== null) {
            $lignes->where('journal_entries.entry_date', '<', $avant->format('Y-m-d'));
        }

        $somme = $lignes
            ->selectRaw('coalesce(sum(journal_lines.debit), 0) as debit, coalesce(sum(journal_lines.credit), 0) as credit')
            ->toBase()->first();

        $debit = MoneyColumns::money($somme->debit ?? 0, $currency);
        $credit = MoneyColumns::money($somme->credit ?? 0, $currency);

        return $sensNormal === Side::Debit ? $debit->subtract($credit) : $credit->subtract($debit);
    }
}
