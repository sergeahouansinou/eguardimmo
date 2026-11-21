<?php

declare(strict_types=1);

namespace App\Modules\Payments;

use App\Modules\Payments\Console\ReconcilePaymentsCommand;
use App\Modules\Payments\Gateways\FakeGateway;
use App\Modules\Payments\Gateways\PaymentGateway;
use App\Modules\Payments\Gateways\UnavailableGateway;
use App\Modules\Payments\Http\Middleware\PrivateResponse;
use App\Modules\Payments\Models\OnlinePayment;
use App\Modules\Payments\Models\PaymentAccount;
use App\Modules\Payments\Support\PaymentsBoot;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

final class PaymentsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PaymentGateway::class, fn (): PaymentGateway => match ((string) config('payments.gateway')) {
            'fake' => new FakeGateway,
            default => new UnavailableGateway,
        });
    }

    public function boot(): void
    {
        if (! $this->commandeDeBuild()) {
            PaymentsBoot::assertBootable(config('payments.gateway'), $this->app->isProduction(), config('payments.providers.fake.webhook_secret'), config('payments.return_url'));
        }

        $this->app->make(Router::class)->aliasMiddleware('payments.private', PrivateResponse::class);
        RateLimiter::for('payments-webhook', fn (Request $request): Limit => Limit::perMinute(600)->by('payments-webhook:'.$request->ip()));

        Relation::enforceMorphMap([
            'online_payment' => OnlinePayment::class,
            'payment_account' => PaymentAccount::class,
        ]);

        if ($this->app->runningInConsole()) {
            $this->commands([ReconcilePaymentsCommand::class]);
        }
    }

    private function commandeDeBuild(): bool
    {
        $commande = $_SERVER['argv'][1] ?? '';

        return $this->app->runningInConsole() && in_array($commande, ['package:discover', 'config:cache', 'config:clear', 'optimize', 'optimize:clear', 'route:cache', 'view:cache', 'event:cache', 'key:generate'], true);
    }
}
