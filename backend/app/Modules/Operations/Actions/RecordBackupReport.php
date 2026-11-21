<?php

declare(strict_types=1);

namespace App\Modules\Operations\Actions;

use App\Modules\Operations\Enums\BackupKind;
use App\Modules\Operations\Enums\RestoreResult;
use App\Modules\Operations\Models\BackupReport;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class RecordBackupReport
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Preuve déposée par le script de l'hébergement (jamais par HTTP) : une ligne par sauvegarde ou test de restauration, jamais modifiée.
     */
    public function handle(
        BackupKind $type,
        CarbonImmutable $debut,
        int $dureeSecondes,
        bool $reussie,
        ?int $tailleOctets,
        ?string $empreinteManifeste,
        ?string $cibleTest,
        ?RestoreResult $resultatTest,
    ): BackupReport {
        return DB::transaction(function () use ($type, $debut, $dureeSecondes, $reussie, $tailleOctets, $empreinteManifeste, $cibleTest, $resultatTest): BackupReport {
            $rapport = BackupReport::query()->create([
                'kind' => $type,
                'started_at' => $debut,
                'duration_seconds' => $dureeSecondes,
                'size_bytes' => $tailleOctets,
                'succeeded' => $reussie,
                'manifest_sha256' => $empreinteManifeste,
                'restore_test_target' => $cibleTest,
                'restore_test_result' => $resultatTest,
            ]);

            $this->audit->handle('operations.backup.recorded', null, [
                'kind' => $type->value,
                'succeeded' => $reussie,
                'size_bytes' => $tailleOctets,
                'restore_test_result' => $resultatTest?->value,
            ], $rapport);

            return $rapport;
        });
    }
}
