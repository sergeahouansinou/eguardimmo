<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions;

use App\Modules\Subscriptions\Console\EndTrialsCommand;
use App\Modules\Subscriptions\Console\SeedPlansCommand;
use App\Modules\Subscriptions\Console\VerifySubscriptionsCommand;
use App\Modules\Subscriptions\Http\Middleware\RequireEntitlement;
use App\Modules\Subscriptions\Models\OrganizationEntitlementOverride;
use App\Modules\Subscriptions\Models\Plan;
use App\Modules\Subscriptions\Models\PlanEntitlement;
use App\Modules\Subscriptions\Models\PlanPrice;
use App\Modules\Subscriptions\Models\PlanVersion;
use App\Modules\Subscriptions\Models\Subscription;
use App\Modules\Subscriptions\Support\SubscriptionApprovalHandlers;
use App\Shared\Approval\ApprovalHandlers;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;

final class SubscriptionsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Relation::enforceMorphMap([
            'plan' => Plan::class,
            'plan_version' => PlanVersion::class,
            'plan_price' => PlanPrice::class,
            'plan_entitlement' => PlanEntitlement::class,
            'subscription' => Subscription::class,
            'organization_entitlement_override' => OrganizationEntitlementOverride::class,
        ]);

        /** @var Router $routeur */
        $routeur = $this->app->make(Router::class);
        $routeur->aliasMiddleware('entitled', RequireEntitlement::class);

        $this->app->make(SubscriptionApprovalHandlers::class)->register($this->app->make(ApprovalHandlers::class));

        if ($this->app->runningInConsole()) {
            $this->commands([SeedPlansCommand::class, EndTrialsCommand::class, VerifySubscriptionsCommand::class]);
        }
    }
}
