<?php

declare(strict_types=1);

namespace App\Modules\Listings;

use App\Modules\Listings\Http\Middleware\EnsureTraveler;
use App\Modules\Listings\Models\Listing;
use App\Modules\Listings\Models\ListingFavorite;
use App\Modules\Listings\Models\ListingLead;
use App\Modules\Listings\Queries\ReminderTargets;
use App\Shared\Http\RateLimitIp;
use App\Shared\Http\SebookRelay;
use App\Shared\Reminders\ReminderRegistry;
use App\Shared\Reminders\ReminderWindow;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

final class ListingsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->app->make(Router::class)->aliasMiddleware('marketplace.traveler', EnsureTraveler::class);

        Relation::enforceMorphMap([
            'listing' => Listing::class,
            'listing_favorite' => ListingFavorite::class,
            'listing_lead' => ListingLead::class,
        ]);

        $rappels = $this->app->make(ReminderRegistry::class);
        $rappels->register('listing_missing', fn (ReminderWindow $fenetre): iterable => $this->app->make(ReminderTargets::class)->organizationsWithoutListing($fenetre));
        $rappels->register('listing_draft', fn (ReminderWindow $fenetre): iterable => $this->app->make(ReminderTargets::class)->drafts($fenetre));
        $rappels->register('lead_unanswered', fn (ReminderWindow $fenetre): iterable => $this->app->make(ReminderTargets::class)->unansweredLeads($fenetre));

        // Clé = IP vue par Laravel (proxies de confiance seulement), jamais un en-tête du client ; seule exception, le relais de SeBook sous sa clé.
        RateLimiter::for('marketplace-listings', fn (Request $request): Limit => SebookRelay::limite($request) ?? Limit::perMinute(60)->by('marketplace-listings:'.RateLimitIp::of($request)));
        RateLimiter::for('marketplace-favorites', fn (Request $request): Limit => Limit::perMinute(60)->by('marketplace-favorites:'.($request->user()?->getAuthIdentifier() ?? RateLimitIp::of($request))));
        RateLimiter::for('marketplace-visit-requests', fn (Request $request): Limit => Limit::perHour(5)->by('marketplace-visit-requests:'.($request->user()?->getAuthIdentifier() ?? RateLimitIp::of($request))));
    }
}
