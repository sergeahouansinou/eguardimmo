<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Models\InterventionFile;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class ShareFile
{
    public function __construct(
        private Locks $verrous,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    /**
     * Seul le partage au mandant se décide ; la visibilité locataire est posée au dépôt et ne change pas.
     */
    public function handle(string $interventionId, string $fileId, bool $visibleMandant): InterventionFile
    {
        return DB::transaction(function () use ($interventionId, $fileId, $visibleMandant): InterventionFile {
            $this->verrous->intervention($interventionId);
            $fichier = (Str::isUuid($fileId) ? InterventionFile::query()->whereKey($fileId)->where('intervention_id', $interventionId)->lockForUpdate()->first() : null)
                ?? throw ErrorCode::FileNotFound->problem();

            if ($fichier->visible_to_owner !== $visibleMandant) {
                $fichier->forceFill(['visible_to_owner' => $visibleMandant])->save();
                $this->audit->handle('maintenance.file.shared', subject: $fichier, metadata: ['intervention_id' => $interventionId, 'visible_to_owner' => $visibleMandant]);
                $this->chronologie->add($this->verrous->intervention($interventionId), EventKind::FileShared, ActorKind::Team, $visibleMandant ? 'Pièce partagée avec le mandant.' : 'Partage de la pièce retiré.');
            }

            return $fichier;
        });
    }
}
