<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\FileKind;
use App\Modules\Maintenance\Models\InterventionFile;
use App\Modules\Maintenance\Support\Attachments;
use App\Modules\Maintenance\Support\Locks;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

final readonly class UploadInterventionFile
{
    public function __construct(
        private Locks $verrous,
        private Attachments $pieces,
    ) {}

    public function handle(string $interventionId, UploadedFile $fichier, FileKind $kind, ActorKind $acteur, bool $visibleLocataire, bool $visibleMandant): InterventionFile
    {
        return DB::transaction(function () use ($interventionId, $fichier, $kind, $acteur, $visibleLocataire, $visibleMandant): InterventionFile {
            $intervention = $this->verrous->intervention($interventionId);

            if ($acteur === ActorKind::Tenant && ($intervention->status->isTerminal() || $kind !== FileKind::PhotoBefore)) {
                throw ErrorCode::FileInvalid->problem();
            }

            return $this->pieces->attach($intervention, $fichier, $kind, $acteur, $acteur === ActorKind::Tenant || $visibleLocataire, $acteur === ActorKind::Tenant ? false : $visibleMandant);
        });
    }
}
