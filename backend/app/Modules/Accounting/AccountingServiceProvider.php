<?php

declare(strict_types=1);

namespace App\Modules\Accounting;

use App\Modules\Accounting\Console\VerifyLedgerCommand;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AccountingPeriod;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Models\JournalLine;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

final class AccountingServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Relation::enforceMorphMap([
            'account' => Account::class,
            'accounting_period' => AccountingPeriod::class,
            'journal_entry' => JournalEntry::class,
            'journal_line' => JournalLine::class,
        ]);

        if ($this->app->runningInConsole()) {
            $this->commands([VerifyLedgerCommand::class]);
        }
    }
}
