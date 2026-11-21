<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Jobs\ScanStoredFile;
use App\Modules\Documents\Queries\FilesToScan;
use App\Modules\Documents\Support\MalwareScanner;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;

final readonly class RescanFiles
{
    public function __construct(
        private FilesToScan $fichiers,
        private MalwareScanner $analyseur,
    ) {}

    /**
     * Relance en file l'analyse des fichiers `unverifiable`, des `pending` de plus de 15 minutes et, avec un analyseur actif, des fichiers
     * déposés avant l'antivirus. Par lots, par ordre de dernière tentative ; alerte (journal d'erreur) au-delà du seuil de non vérifiables.
     *
     * @return int fichiers relancés
     */
    public function handle(int $limite = FilesToScan::LOT): int
    {
        $lignes = $this->fichiers->stalled(CarbonImmutable::now()->subMinutes(15), $this->analyseur->enabled(), $limite);

        foreach ($lignes as $ligne) {
            ScanStoredFile::dispatch($ligne['organization_id'], $ligne['id']);
        }

        $this->alerter();

        return count($lignes);
    }

    private function alerter(): void
    {
        $seuil = (int) config('documents.malware.alert_threshold');
        $nombre = $this->fichiers->unverifiableCount();

        if ($nombre > $seuil) {
            Log::error('Fichiers non vérifiables au-delà du seuil : l\'analyseur antivirus est probablement injoignable', ['count' => $nombre, 'threshold' => $seuil]);
        }
    }
}
