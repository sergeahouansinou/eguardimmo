<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Queries;

use App\Modules\Accounting\Data\AccountSummaryData;
use App\Modules\Accounting\Enums\Side;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\JournalLine;
use App\Modules\Accounting\Support\MoneyColumns;

final class AccountOverview
{
    /**
     * @return list<AccountSummaryData>
     */
    public function all(): array
    {
        $sommes = JournalLine::query()
            ->selectRaw('account_id, currency, sum(debit) as debit, sum(credit) as credit')
            ->groupBy('account_id', 'currency')
            ->orderBy('currency')
            ->toBase()->get()->groupBy('account_id');

        return array_values(Account::query()->orderBy('code')->get()->map(function (Account $compte) use ($sommes): AccountSummaryData {
            $soldes = [];

            foreach ($sommes->get($compte->id, []) as $somme) {
                $devise = MoneyColumns::currency($somme->currency);
                $debit = MoneyColumns::money($somme->debit, $devise);
                $credit = MoneyColumns::money($somme->credit, $devise);
                $soldes[] = $compte->role->normalSide() === Side::Debit ? $debit->subtract($credit) : $credit->subtract($debit);
            }

            return new AccountSummaryData($compte->id, $compte->code, $compte->label, $compte->role, $soldes);
        })->all());
    }
}
