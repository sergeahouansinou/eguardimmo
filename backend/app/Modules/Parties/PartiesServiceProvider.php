<?php

declare(strict_types=1);

namespace App\Modules\Parties;

use App\Modules\Identity\Data\ProfileData;
use App\Modules\Identity\Enums\Space;
use App\Modules\Identity\PublicApi\ProfileRegistry;
use App\Modules\Parties\Console\PurgeContactUpdatesCommand;
use App\Modules\Parties\Http\Middleware\PrivateInvitationResponse;
use App\Modules\Parties\Http\Middleware\PrivateResponse;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\ContactUpdateRequest;
use App\Modules\Parties\Models\OwnerAccess;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Models\PartyContactCategory;
use App\Modules\Parties\Models\PartyIdentifier;
use App\Modules\Parties\Models\PartyImport;
use App\Modules\Parties\PublicApi\OwnerLinks;
use App\Modules\Parties\PublicApi\PartyLinks;
use App\Modules\Parties\Queries\PlatformAudiences;
use App\Shared\Audience\AudienceRegistry;
use App\Shared\Http\RateLimitIp;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

final class PartiesServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Relation::enforceMorphMap([
            'party' => Party::class,
            'party_contact_category' => PartyContactCategory::class,
            'contact_point' => ContactPoint::class,
            'party_identifier' => PartyIdentifier::class,
            'bank_account' => BankAccount::class,
            'owner_access' => OwnerAccess::class,
            'contact_update_request' => ContactUpdateRequest::class,
            'party_import' => PartyImport::class,
        ]);

        $this->app->make(ProfileRegistry::class)->register(function (string $userId): array {
            $liens = $this->app->make(PartyLinks::class)->linkedTo($userId);

            return $liens === [] ? [] : [new ProfileData(Space::Tenant, 'Locataire', ['links' => count($liens)])];
        });

        $this->app->make(ProfileRegistry::class)->register(function (string $userId): array {
            $acces = $this->app->make(OwnerLinks::class)->activeFor($userId);

            return $acces === [] ? [] : [new ProfileData(Space::Owner, 'Propriétaire mandant', ['links' => count($acces)])];
        });

        $this->app->make(Router::class)->aliasMiddleware('parties.private-invitation', PrivateInvitationResponse::class);
        $this->app->make(Router::class)->aliasMiddleware('parties.private', PrivateResponse::class);

        $groupes = $this->app->make(AudienceRegistry::class);
        $groupes->register('tenants', fn (): iterable => $this->app->make(PlatformAudiences::class)->tenants());
        $groupes->register('owners', fn (): iterable => $this->app->make(PlatformAudiences::class)->owners());

        if ($this->app->runningInConsole()) {
            $this->commands([PurgeContactUpdatesCommand::class]);
        }

        $this->configurerLimiteInvitationProprietaire();
    }

    /**
     * Aperçu et acceptation d'une invitation propriétaire : un seau par IP, un par compte et un par jeton. Le jeton est haché,
     * il n'apparaît ni en cache ni en journal. Le code d'appariement a en plus ses cinq essais par invitation.
     */
    private function configurerLimiteInvitationProprietaire(): void
    {
        RateLimiter::for('owner-invitation', function (Request $request): array {
            $jeton = (string) $request->input('token');
            $compte = $request->user()?->getAuthIdentifier();

            return [
                Limit::perMinute(30)->by('owner-invitation-ip:'.RateLimitIp::of($request)),
                Limit::perMinute(10)->by('owner-invitation-compte:'.(is_string($compte) ? $compte : 'ip:'.RateLimitIp::of($request))),
                Limit::perHour(20)->by('owner-invitation-jeton:'.hash('sha256', $jeton)),
            ];
        });
    }
}
