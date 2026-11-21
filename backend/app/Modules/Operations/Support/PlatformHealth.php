<?php

declare(strict_types=1);

namespace App\Modules\Operations\Support;

use App\Modules\Operations\Data\ProbeResult;
use App\Modules\Operations\Enums\ProbeState;
use App\Modules\Operations\Support\Probes\AntivirusProbe;
use App\Modules\Operations\Support\Probes\BackupProbe;
use App\Modules\Operations\Support\Probes\DatabaseProbe;
use App\Modules\Operations\Support\Probes\MailProbe;
use App\Modules\Operations\Support\Probes\PaymentsProbe;
use App\Modules\Operations\Support\Probes\PdfProbe;
use App\Modules\Operations\Support\Probes\Probe;
use App\Modules\Operations\Support\Probes\QueueProbe;
use App\Modules\Operations\Support\Probes\SchedulerProbe;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Santé de la plateforme vue de l'application : chaque sonde est isolée, une panne de sonde est `unknown` (jamais `ok`, jamais `down` sans
 * preuve), le résultat est gardé 30 secondes pour que la console ne soit pas un moyen de charger la base. Disponibilité, latence, 5xx,
 * disque et mémoire relèvent de la supervision externe.
 */
final readonly class PlatformHealth
{
    private const string CLE_CACHE = 'operations:platform-health';

    /**
     * @param  list<Probe>  $sondes
     */
    public function __construct(private array $sondes) {}

    public static function make(): self
    {
        return new self([
            app(DatabaseProbe::class),
            app(QueueProbe::class),
            app(SchedulerProbe::class),
            app(AntivirusProbe::class),
            app(PdfProbe::class),
            app(MailProbe::class),
            app(PaymentsProbe::class),
            app(BackupProbe::class),
        ]);
    }

    /**
     * @return array{status: string, checked_at: string, components: array<string, array<string, mixed>>}
     */
    public function report(): array
    {
        /** @var array{status: string, checked_at: string, components: array<string, array<string, mixed>>} $rapport */
        $rapport = Cache::remember(self::CLE_CACHE, (int) config('operations.health_cache_seconds'), fn (): array => $this->probe());

        return $rapport;
    }

    /**
     * @return array{status: string, checked_at: string, components: array<string, array<string, mixed>>}
     */
    private function probe(): array
    {
        $composants = [];
        $pire = ProbeState::Ok;

        foreach ($this->sondes as $sonde) {
            $resultat = $this->lancer($sonde);
            $composants[$sonde->key()] = $resultat->toArray();
            $pire = $resultat->state->severity() > $pire->severity() ? $resultat->state : $pire;
        }

        return ['status' => $pire->value, 'checked_at' => now()->toIso8601String(), 'components' => $composants];
    }

    private function lancer(Probe $sonde): ProbeResult
    {
        try {
            return $sonde->run();
        } catch (Throwable $erreur) {
            Log::warning('sonde de santé en erreur', ['sonde' => $sonde->key(), 'classe' => $erreur::class]);

            return new ProbeResult(ProbeState::Unknown);
        }
    }
}
