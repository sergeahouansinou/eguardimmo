<?php

declare(strict_types=1);

namespace App\Modules\Notifications;

use App\Modules\Notifications\Console\DispatchCampaignsCommand;
use App\Modules\Notifications\Console\PrunePushTokensCommand;
use App\Modules\Notifications\Console\PurgeCampaignsCommand;
use App\Modules\Notifications\Console\ResumeCampaignsCommand;
use App\Modules\Notifications\Http\Middleware\EnsureCampaignManager;
use App\Modules\Notifications\Http\Middleware\PrivateCampaignResponse;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignAttachment;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Push\FakeDriver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

final class NotificationsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(FakeDriver::class);
    }

    public function boot(Router $routeur): void
    {
        $routeur->aliasMiddleware('campaigns.private', PrivateCampaignResponse::class);
        $routeur->aliasMiddleware('campaigns.manage', EnsureCampaignManager::class);
        $this->loadViewsFrom(__DIR__.'/Views', 'notifications');

        RateLimiter::for('mail-unsubscribe', fn (Request $request): array => [
            Limit::perMinute(30)->by('mail-unsubscribe:token:'.hash('sha256', (string) $request->route('token'))),
            Limit::perMinute(600)->by('mail-unsubscribe:ip:'.$request->ip()),
        ]);
        RateLimiter::for('org-campaigns-test', fn (Request $request): Limit => Limit::perHour(max(1, (int) config('notifications.campaigns.hourly_tests')))
            ->by('org-campaigns-test:'.($request->user()?->getAuthIdentifier() ?? $request->ip())));
        RateLimiter::for('mail-webhook', fn (Request $request): Limit => Limit::perMinute(600)->by('mail-webhook:'.$request->ip()));

        Relation::enforceMorphMap([
            'campaign' => Campaign::class,
            'campaign_attachment' => CampaignAttachment::class,
            'campaign_delivery' => CampaignDelivery::class,
        ]);

        if ($this->app->runningInConsole()) {
            $this->commands([PrunePushTokensCommand::class, DispatchCampaignsCommand::class, ResumeCampaignsCommand::class, PurgeCampaignsCommand::class]);
        }
    }
}
