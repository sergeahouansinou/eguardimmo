<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds;

use App\Modules\OwnerFunds\Console\BackfillCommand;
use App\Modules\OwnerFunds\Console\ExpirePayoutRequestsCommand;
use App\Modules\OwnerFunds\Console\ReconcileCommand;
use App\Modules\OwnerFunds\Console\VerifyCommand;
use App\Modules\OwnerFunds\Http\Middleware\RequireAgencyOrganization;
use App\Modules\OwnerFunds\Models\FeeStatement;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use App\Modules\OwnerFunds\Models\PayoutHold;
use App\Modules\OwnerFunds\Models\PayoutItem;
use App\Modules\OwnerFunds\Models\TrustDepositRequest;
use App\Modules\OwnerFunds\Models\TrustTransfer;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;

final class OwnerFundsServiceProvider extends ServiceProvider
{
    public function boot(Router $routeur): void
    {
        $routeur->aliasMiddleware('ownerfunds.agency', RequireAgencyOrganization::class);

        if ($this->app->runningInConsole()) {
            $this->commands([BackfillCommand::class, VerifyCommand::class, ReconcileCommand::class, ExpirePayoutRequestsCommand::class]);
        }

        Relation::enforceMorphMap([
            'fee_statement' => FeeStatement::class,
            'payout_account_request' => PayoutAccountRequest::class,
            'payout_batch' => PayoutBatch::class,
            'payout_item' => PayoutItem::class,
            'payout_hold' => PayoutHold::class,
            'trust_transfer' => TrustTransfer::class,
            'trust_deposit_request' => TrustDepositRequest::class,
        ]);
    }
}
