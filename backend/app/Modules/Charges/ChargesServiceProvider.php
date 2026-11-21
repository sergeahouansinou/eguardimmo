<?php

declare(strict_types=1);

namespace App\Modules\Charges;

use App\Modules\Charges\Console\FlagDueRegularizationsCommand;
use App\Modules\Charges\Console\VerifyChargesCommand;
use App\Modules\Charges\Http\Middleware\PrivateResponse;
use App\Modules\Charges\Models\ChargeConsumption;
use App\Modules\Charges\Models\ChargeDueFlag;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeIdempotency;
use App\Modules\Charges\Models\ChargeItem;
use App\Modules\Charges\Models\ChargeItemSource;
use App\Modules\Charges\Models\ChargeKey;
use App\Modules\Charges\Models\ChargeKeyShare;
use App\Modules\Charges\Models\ChargeKeyVersion;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\ChargeStatementFile;
use App\Modules\Charges\Models\ChargeStatementLine;
use App\Modules\Charges\Models\ChargeStatementPlan;
use App\Modules\Charges\Models\Expense;
use App\Modules\Charges\Models\ExpenseFile;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;

final class ChargesServiceProvider extends ServiceProvider
{
    public function boot(Router $routeur): void
    {
        Relation::enforceMorphMap([
            'expense' => Expense::class,
            'expense_file' => ExpenseFile::class,
            'charge_key' => ChargeKey::class,
            'charge_key_version' => ChargeKeyVersion::class,
            'charge_key_share' => ChargeKeyShare::class,
            'charge_exercise' => ChargeExercise::class,
            'charge_item' => ChargeItem::class,
            'charge_consumption' => ChargeConsumption::class,
            'charge_item_source' => ChargeItemSource::class,
            'charge_statement' => ChargeStatement::class,
            'charge_statement_line' => ChargeStatementLine::class,
            'charge_statement_file' => ChargeStatementFile::class,
            'charge_statement_plan' => ChargeStatementPlan::class,
            'charge_idempotency' => ChargeIdempotency::class,
            'charge_due_flag' => ChargeDueFlag::class,
        ]);

        $this->loadViewsFrom(__DIR__.'/Views', 'charges');
        $routeur->aliasMiddleware('charges.private', PrivateResponse::class);

        if ($this->app->runningInConsole()) {
            $this->commands([VerifyChargesCommand::class, FlagDueRegularizationsCommand::class]);
        }
    }
}
