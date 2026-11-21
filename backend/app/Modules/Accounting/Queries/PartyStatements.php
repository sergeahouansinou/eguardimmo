<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Queries;

use App\Modules\Accounting\Data\PartyStatementData;
use App\Modules\Accounting\Data\PartyStatementLineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ErrorCode;
use App\Modules\Accounting\Enums\Side;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\Models\JournalLine;
use App\Modules\Accounting\Support\MoneyColumns;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\JoinClause;
use Money\Currency;
use Money\Money;

/**
 * Relevé d'un compte pour une partie (compte d'un mandant) : ouverture, lignes avec la pièce d'origine, clôture.
 */
final class PartyStatements
{
    public function of(string $partyId, AccountRole $role, Currency $currency, CarbonImmutable $from, CarbonImmutable $to): PartyStatementData
    {
        $ouverture = $this->solde($partyId, $role, $currency, $from->format('Y-m-d'));
        $lignes = [];
        $courant = $ouverture;

        $rows = $this->base($partyId, $role, $currency)
            ->where('e.entry_date', '>=', $from->format('Y-m-d'))
            ->where('e.entry_date', '<', $to->addDay()->format('Y-m-d'))
            ->orderBy('e.entry_date')->orderBy('e.fiscal_year')->orderBy('e.number')->orderBy('journal_lines.position')
            ->select([
                'journal_lines.debit', 'journal_lines.credit', 'journal_lines.unit_id', 'journal_lines.lease_id',
                'e.id as entry_id', 'e.fiscal_year', 'e.number', 'e.entry_date', 'e.label', 'e.source_type', 'e.source_id',
                'e.reversal_of_id', 'o.source_type as origin_source_type', 'o.source_id as origin_source_id',
            ])
            ->limit(Balances::RELEVE_LIGNES_MAX + 1)
            ->toBase()->get();

        if ($rows->count() > Balances::RELEVE_LIGNES_MAX) {
            throw ErrorCode::StatementTooLong->problem();
        }

        foreach ($rows as $row) {
            $debit = MoneyColumns::money($row->debit, $currency);
            $credit = MoneyColumns::money($row->credit, $currency);
            $courant = $role->normalSide() === Side::Debit ? $courant->add($debit)->subtract($credit) : $courant->add($credit)->subtract($debit);
            $reversal = is_string($row->reversal_of_id);
            $lignes[] = new PartyStatementLineData(
                entryId: (string) $row->entry_id,
                reference: sprintf('%d-%06d', $row->fiscal_year, $row->number),
                date: CarbonImmutable::parse(substr((string) $row->entry_date, 0, 10)),
                source: SourceType::from((string) ($reversal ? $row->origin_source_type : $row->source_type)),
                sourceId: (string) ($reversal ? $row->origin_source_id : $row->source_id),
                unitId: is_string($row->unit_id) ? $row->unit_id : null,
                leaseId: is_string($row->lease_id) ? $row->lease_id : null,
                label: (string) $row->label,
                isReversal: $reversal,
                debit: $debit,
                credit: $credit,
                balance: $courant,
            );
        }

        return new PartyStatementData($partyId, $from, $to, $ouverture, $lignes, $courant);
    }

    private function solde(string $partyId, AccountRole $role, Currency $currency, string $avant): Money
    {
        $somme = $this->base($partyId, $role, $currency)->where('e.entry_date', '<', $avant)->selectRaw('coalesce(sum(journal_lines.debit), 0) as debit, coalesce(sum(journal_lines.credit), 0) as credit')->toBase()->first();
        $debit = MoneyColumns::money($somme->debit ?? 0, $currency);
        $credit = MoneyColumns::money($somme->credit ?? 0, $currency);

        return $role->normalSide() === Side::Debit ? $debit->subtract($credit) : $credit->subtract($debit);
    }

    /**
     * @return Builder<JournalLine>
     */
    private function base(string $partyId, AccountRole $role, Currency $currency): Builder
    {
        return JournalLine::query()
            ->join('journal_entries as e', fn (JoinClause $j) => $j->on('e.id', '=', 'journal_lines.journal_entry_id')->on('e.organization_id', '=', 'journal_lines.organization_id'))
            ->join('accounts as a', fn (JoinClause $j) => $j->on('a.id', '=', 'journal_lines.account_id')->on('a.organization_id', '=', 'journal_lines.organization_id'))
            ->leftJoin('journal_entries as o', fn (JoinClause $j) => $j->on('o.id', '=', 'e.reversal_of_id')->on('o.organization_id', '=', 'e.organization_id'))
            ->where('a.role', $role->value)
            ->where('journal_lines.party_id', $partyId)
            ->where('journal_lines.currency', $currency->getCode());
    }
}
