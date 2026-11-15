<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Queries;

use App\Modules\Accounting\Data\LeaseStatementData;
use App\Modules\Accounting\Data\StatementLineData;
use App\Modules\Accounting\Enums\AccountRole;
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
    public function account(AccountRole $role, Currency $currency, ?CarbonImmutable $asOf): Money
    {
        return $this->solde($this->lignes($role, $currency), $currency, $role->normalSide(), $asOf);
    }

    public function receivable(string $colonne, string $valeur, Currency $currency, ?CarbonImmutable $asOf): Money
    {
        $role = AccountRole::TenantReceivable;

        return $this->solde($this->lignes($role, $currency)->where("journal_lines.{$colonne}", $valeur), $currency, $role->normalSide(), $asOf);
    }

    public function item(ItemType $type, string $id, Currency $currency, ?CarbonImmutable $asOf): Money
    {
        $role = AccountRole::TenantReceivable;

        return $this->solde(
            $this->lignes($role, $currency)->where('journal_lines.item_type', $type->value)->where('journal_lines.item_id', $id),
            $currency,
            $role->normalSide(),
            $asOf,
        );
    }

    public function statement(string $leaseId, Currency $currency, CarbonImmutable $from, CarbonImmutable $to): LeaseStatementData
    {
        $role = AccountRole::TenantReceivable;
        $ouverture = $this->solde(
            $this->lignes($role, $currency)->where('journal_lines.lease_id', $leaseId),
            $currency,
            $role->normalSide(),
            null,
            avant: $from,
        );

        $lignes = [];
        $courant = $ouverture;

        $rows = $this->lignes($role, $currency)
            ->where('journal_lines.lease_id', $leaseId)
            ->where('journal_entries.entry_date', '>=', $from->format('Y-m-d'))
            ->where('journal_entries.entry_date', '<', $to->addDay()->format('Y-m-d'))
            ->orderBy('journal_entries.entry_date')->orderBy('journal_entries.fiscal_year')->orderBy('journal_entries.number')->orderBy('journal_lines.position')
            ->select([
                'journal_lines.debit', 'journal_lines.credit',
                'journal_entries.id as entry_id', 'journal_entries.fiscal_year', 'journal_entries.number',
                'journal_entries.journal', 'journal_entries.entry_date', 'journal_entries.label',
            ])
            ->toBase()->get();

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
    private function lignes(AccountRole $role, Currency $currency): Builder
    {
        return JournalLine::query()
            ->join('journal_entries', function ($jointure): void {
                $jointure->on('journal_entries.id', '=', 'journal_lines.journal_entry_id')
                    ->on('journal_entries.organization_id', '=', 'journal_lines.organization_id');
            })
            ->whereIn('journal_lines.account_id', Account::query()->where('role', $role->value)->select('id'))
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
