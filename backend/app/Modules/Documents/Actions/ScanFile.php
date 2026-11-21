<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Enums\ScanStatus;
use App\Modules\Documents\Enums\ScanVerdict;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\Support\MalwareScanner;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final readonly class ScanFile
{
    public function __construct(
        private MalwareScanner $analyseur,
        private RecordAudit $audit,
    ) {}

    /**
     * Analyse un fichier `pending` ou `unverifiable` de l'organisation courante, ou un fichier déposé avant l'antivirus (`clean` sans date
     * d'analyse). Un fichier sain devient `clean` ; un fichier infecté est mis en quarantaine (contenu supprimé, ligne gardée) ; un analyseur
     * injoignable laisse un fichier `unverifiable` bloqué et un fichier déjà `clean` dans son état, la tentative étant seulement datée.
     * Rejouable : un fichier déjà tranché n'est pas réanalysé.
     */
    public function handle(string $id): ScanStatus
    {
        $fichier = Str::isUuid($id) ? StoredFile::query()->find($id) : null;

        if ($fichier === null) {
            return ScanStatus::Clean;
        }

        $ancien = $this->ancien($fichier);

        if (! $ancien && ! in_array($fichier->scan_status, [ScanStatus::Pending, ScanStatus::Unverifiable], true)) {
            return $fichier->scan_status;
        }

        return $this->conclure($fichier, $this->verdict($fichier), $ancien);
    }

    private function ancien(StoredFile $fichier): bool
    {
        return $fichier->scan_status === ScanStatus::Clean
            && $fichier->scanned_at === null
            && $this->analyseur->enabled()
            && in_array($fichier->category->value, FileCategory::scanned(), true);
    }

    private function verdict(StoredFile $fichier): ScanVerdict
    {
        $flux = Storage::disk($fichier->disk)->readStream($fichier->path);

        if (! is_resource($flux)) {
            Log::warning('Contenu absent pour l\'analyse', ['file' => $fichier->id]);

            return ScanVerdict::Unverifiable;
        }

        try {
            return $this->analyseur->scan($flux);
        } finally {
            fclose($flux);
        }
    }

    private function conclure(StoredFile $fichier, ScanVerdict $verdict, bool $ancien): ScanStatus
    {
        if ($ancien && $verdict === ScanVerdict::Unverifiable) {
            $fichier->forceFill(['scan_attempted_at' => now()])->save();

            return ScanStatus::Clean;
        }

        $statut = match ($verdict) {
            ScanVerdict::Clean => ScanStatus::Clean,
            ScanVerdict::Infected => ScanStatus::Infected,
            ScanVerdict::Unverifiable => ScanStatus::Unverifiable,
        };

        DB::transaction(function () use ($fichier, $statut): void {
            $fichier->forceFill([
                'scan_status' => $statut,
                'scan_attempted_at' => now(),
                'scanned_at' => $statut === ScanStatus::Unverifiable ? $fichier->scanned_at : now(),
            ])->save();
            $this->audit->handle('documents.file.scanned', subject: $fichier, metadata: ['result' => $statut->value]);
        });

        if ($statut === ScanStatus::Infected) {
            Storage::disk($fichier->disk)->delete($fichier->path);
        }

        return $statut;
    }
}
