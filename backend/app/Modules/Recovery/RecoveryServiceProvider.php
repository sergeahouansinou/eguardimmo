<?php

declare(strict_types=1);

namespace App\Modules\Recovery;

use App\Modules\Recovery\Models\RecoveryAct;
use App\Modules\Recovery\Models\RecoveryBundle;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryCaseItem;
use App\Modules\Recovery\Models\RecoveryTransmission;
use App\Modules\Recovery\Models\RecoveryTransmissionDownload;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

final class RecoveryServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Relation::enforceMorphMap([
            'recovery_case' => RecoveryCase::class,
            'recovery_case_item' => RecoveryCaseItem::class,
            'recovery_act' => RecoveryAct::class,
            'recovery_bundle' => RecoveryBundle::class,
            'recovery_transmission' => RecoveryTransmission::class,
            'recovery_transmission_download' => RecoveryTransmissionDownload::class,
        ]);

        $this->loadViewsFrom(__DIR__.'/Views', 'recovery');
        $this->configurerLimites();
    }

    private function configurerLimites(): void
    {
        // Clé = IP vue par Laravel (proxies de confiance seulement) : ni query ni en-tête client, sinon le seau se contourne.
        RateLimiter::for('recovery-download', fn (Request $request): Limit => Limit::perMinute($this->limite('download_per_minute', 5))->by('recovery-download:'.$request->ip()));

        RateLimiter::for('recovery-generation', function (Request $request): Limit {
            $organisation = $request->route('organization');
            $organisation = $organisation instanceof Model ? $organisation->getKey() : $organisation;
            $utilisateur = $request->user()?->getAuthIdentifier();

            return Limit::perMinute($this->limite('generation_per_minute', 6))
                ->by('recovery-generation:'.(is_scalar($organisation) ? $organisation : '-').':'.(is_scalar($utilisateur) ? $utilisateur : $request->ip()));
        });
    }

    private function limite(string $cle, int $defaut): int
    {
        $valeur = config("recovery.rate_limits.{$cle}");

        return is_int($valeur) && $valeur > 0 ? $valeur : $defaut;
    }
}
