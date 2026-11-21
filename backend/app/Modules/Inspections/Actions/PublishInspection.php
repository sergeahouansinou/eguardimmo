<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Enums\ErrorCode;
use App\Modules\Inspections\Enums\InspectionKind;
use App\Modules\Inspections\Events\InspectionPublished;
use App\Modules\Inspections\Models\Inspection;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class PublishInspection
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Rend l'état des lieux lisible par les locataires du bail. Rejouable : un état déjà publié est rendu tel quel, sans second événement.
     * Un état de sortie se publie une fois sa conformité à l'état d'entrée renseignée : elle fixe le délai de restitution du dépôt.
     */
    public function handle(Inspection $etat, User $user): Inspection
    {
        return DB::transaction(function () use ($etat, $user): Inspection {
            $verrouille = Inspection::query()->whereKey($etat->id)->lockForUpdate()->firstOrFail();

            if ($verrouille->published_at !== null) {
                return $verrouille;
            }

            if ($verrouille->kind === InspectionKind::Exit && $verrouille->exit_matches_entry === null) {
                throw ErrorCode::InspectionNotPublishable->problem('Indiquez d\'abord si l\'état des lieux de sortie est conforme à celui d\'entrée.');
            }

            $verrouille->forceFill(['published_at' => now(), 'published_by_user_id' => $user->id, 'lock_version' => $verrouille->lock_version + 1])->save();
            $this->audit->handle('inspections.inspection.published', $user->id, ['kind' => $verrouille->kind->value], $verrouille);
            InspectionPublished::dispatch($verrouille->id, $verrouille->lease_id, $verrouille->organization_id, $verrouille->kind->value);

            return $verrouille;
        });
    }
}
