<?php

declare(strict_types=1);

namespace App\Modules\Bookings;

use App\Modules\Bookings\Console\SweepBookingsCommand;
use App\Modules\Bookings\Models\Booking;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

final class BookingsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Relation::enforceMorphMap(['booking' => Booking::class]);

        // Clé = IP vue par Laravel (proxies de confiance seulement), jamais un en-tête du client.
        RateLimiter::for('marketplace-availability', fn (Request $request): Limit => Limit::perMinute(60)->by('marketplace-availability:'.$request->ip()));
        RateLimiter::for('marketplace-quote', fn (Request $request): Limit => Limit::perMinute(30)->by('marketplace-quote:'.$request->ip()));

        RateLimiter::for('marketplace-bookings-create', fn (Request $request): Limit => Limit::perHour(10)->by('marketplace-bookings-create:'.($request->user()?->getAuthIdentifier() ?? $request->ip())));

        if ($this->app->runningInConsole()) {
            $this->commands([SweepBookingsCommand::class]);
        }
    }
}
