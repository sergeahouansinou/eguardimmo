<?php

declare(strict_types=1);

namespace App\Modules\Geography;

use App\Modules\Geography\Models\City;
use App\Modules\Geography\Models\Country;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

final class GeographyServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Relation::enforceMorphMap([
            'geo_country' => Country::class,
            'geo_city' => City::class,
        ]);

        // Clé = IP vue par Laravel (proxies de confiance seulement), jamais un en-tête du client.
        RateLimiter::for('marketplace-places', fn (Request $request): Limit => Limit::perMinute(30)->by('marketplace-places:'.$request->ip()));
    }
}
