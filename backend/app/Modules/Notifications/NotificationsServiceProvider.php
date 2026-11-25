<?php

declare(strict_types=1);

namespace App\Modules\Notifications;

use App\Modules\Notifications\Console\DispatchCampaignsCommand;
use App\Modules\Notifications\Console\PrunePushTokensCommand;
use App\Modules\Notifications\Console\PurgeCampaignsCommand;
use App\Modules\Notifications\Console\ResumeCampaignsCommand;
use App\Modules\Notifications\Console\ResumePlatformCampaignsCommand;
use App\Modules\Notifications\Console\SendRemindersCommand;
use App\Modules\Notifications\Http\Middleware\EnsureCampaignManager;
use App\Modules\Notifications\Http\Middleware\PrivateCampaignResponse;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignAttachment;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Models\NotificationPlatformSetting;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use App\Modules\Notifications\Models\PlatformCampaignImage;
use App\Modules\Notifications\Models\ReminderRule;
use App\Modules\Notifications\Push\FakeDriver;
use App\Shared\Http\RateLimitIp;
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
            Limit::perMinute(600)->by('mail-unsubscribe:ip:'.RateLimitIp::of($request)),
        ]);
        RateLimiter::for('org-campaigns-test', fn (Request $request): Limit => Limit::perHour(max(1, (int) config('notifications.campaigns.hourly_tests')))
            ->by('org-campaigns-test:'.($request->user()?->getAuthIdentifier() ?? RateLimitIp::of($request))));
        RateLimiter::for('mail-webhook', fn (Request $request): Limit => Limit::perMinute(600)->by('mail-webhook:'.RateLimitIp::of($request)));

        $operateur = fn (string $nom, Request $request): string => $nom.':'.($request->user()?->getAuthIdentifier() ?? RateLimitIp::of($request));
        RateLimiter::for('console-marketing-write', fn (Request $request): Limit => Limit::perMinute(30)->by($operateur('console-marketing-write', $request)));
        RateLimiter::for('console-marketing-estimate', fn (Request $request): Limit => Limit::perMinute(15)->by($operateur('console-marketing-estimate', $request)));
        RateLimiter::for('console-marketing-send', fn (Request $request): Limit => Limit::perHour(10)->by($operateur('console-marketing-send', $request)));
        RateLimiter::for('console-marketing-test', fn (Request $request): Limit => Limit::perHour(10)->by($operateur('console-marketing-test', $request)));

        Relation::enforceMorphMap([
            'campaign' => Campaign::class,
            'campaign_attachment' => CampaignAttachment::class,
            'campaign_delivery' => CampaignDelivery::class,
            'platform_campaign' => PlatformCampaign::class,
            'platform_campaign_image' => PlatformCampaignImage::class,
            'platform_campaign_delivery' => PlatformCampaignDelivery::class,
            'reminder_rule' => ReminderRule::class,
            'notification_platform_setting' => NotificationPlatformSetting::class,
        ]);

        if ($this->app->runningInConsole()) {
            $this->commands([PrunePushTokensCommand::class, DispatchCampaignsCommand::class, ResumeCampaignsCommand::class, PurgeCampaignsCommand::class, SendRemindersCommand::class, ResumePlatformCampaignsCommand::class]);
        }
    }
}
