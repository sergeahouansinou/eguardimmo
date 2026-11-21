<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Enums\ErrorCode;
use App\Modules\Inspections\Enums\InspectionKind;
use App\Modules\Inspections\Enums\InspectionPerformer;
use App\Modules\Inspections\Models\Inspection;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final readonly class UpdateInspection
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Corrige un état des lieux non publié ; un état publié est figé, la correction passe par un nouvel enregistrement.
     *
     * @param  array{performed_on?: CarbonImmutable, performed_by?: InspectionPerformer, signatories?: list<array{name: string, capacity: string, date: string}>, exit_matches_entry?: bool|null}  $changes
     */
    public function handle(Inspection $etat, User $user, int $lockVersion, array $changes): Inspection
    {
        return DB::transaction(function () use ($etat, $user, $lockVersion, $changes): Inspection {
            $verrouille = Inspection::query()->whereKey($etat->id)->lockForUpdate()->firstOrFail();

            if ($verrouille->published_at !== null) {
                throw ErrorCode::InspectionPublished->problem();
            }

            if ($verrouille->lock_version !== $lockVersion) {
                throw ErrorCode::InspectionStaleVersion->problem();
            }

            if (($changes['exit_matches_entry'] ?? null) !== null && $verrouille->kind === InspectionKind::Entry) {
                throw ValidationException::withMessages(['exit_matches_entry' => 'La conformité ne se renseigne que pour un état des lieux de sortie.']);
            }

            $verrouille->forceFill([...$changes, 'lock_version' => $verrouille->lock_version + 1])->save();
            $this->audit->handle('inspections.inspection.updated', $user->id, ['fields' => array_keys($changes)], $verrouille);

            return $verrouille;
        });
    }
}
