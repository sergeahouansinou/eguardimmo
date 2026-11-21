<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExerciseStatus;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Support\Locks;
use App\Modules\Charges\Support\StatementStore;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class DiscardExercise
{
    public function __construct(
        private Locks $verrous,
        private StatementStore $decomptes,
        private RecordAudit $audit,
    ) {}

    public function handle(string $id): ChargeExercise
    {
        return DB::transaction(function () use ($id): ChargeExercise {
            $exercice = $this->verrous->exerciseOfProperty($id);

            if ($exercice->status === ExerciseStatus::Discarded) {
                return $exercice;
            }

            if (! $exercice->status->isEditable()) {
                throw ErrorCode::ExerciseStateInvalid->problem();
            }

            $retires = $this->decomptes->purgeComputed($exercice->id);
            $exercice->forceFill(['status' => ExerciseStatus::Discarded, 'lock_version' => $exercice->lock_version + 1])->save();
            $this->audit->handle('charges.exercise.discarded', subject: $exercice, metadata: ['statements_removed' => $retires]);

            return $exercice;
        });
    }
}
