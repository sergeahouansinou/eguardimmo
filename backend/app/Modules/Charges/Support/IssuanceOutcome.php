<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Enums\ExerciseStatus;
use App\Modules\Charges\Enums\StatementStatus;
use App\Modules\Charges\Models\ChargeStatement;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Suites d'une émission : un bail en panne reste `failed` et se reprend ; l'exercice passe `issued` quand plus rien n'attend (ADR 0034 § 6).
 */
final readonly class IssuanceOutcome
{
    public function __construct(
        private Locks $verrous,
        private RecordAudit $audit,
    ) {}

    public function markFailed(string $statementId, string $code): void
    {
        DB::transaction(function () use ($statementId, $code): void {
            $exerciceId = ChargeStatement::query()->whereKey($statementId)->value('exercise_id');
            $this->verrous->exerciseOfProperty(is_string($exerciceId) ? $exerciceId : '');
            $decompte = $this->verrous->statement($statementId);

            if (in_array($decompte->status, [StatementStatus::Computed, StatementStatus::Failed], true)) {
                $decompte->forceFill(['status' => StatementStatus::Failed, 'failure_reason' => mb_substr($code, 0, 255), 'lock_version' => $decompte->lock_version + 1])->save();
            }
        });
    }

    public function finalize(string $exerciseId): void
    {
        DB::transaction(function () use ($exerciseId): void {
            $exercice = $this->verrous->exerciseOfProperty($exerciseId);
            $restants = ChargeStatement::query()->where('exercise_id', $exercice->id)->whereIn('status', [StatementStatus::Computed->value, StatementStatus::Failed->value])->exists();

            if ($exercice->status === ExerciseStatus::Issuing && ! $restants) {
                $exercice->forceFill(['status' => ExerciseStatus::Issued, 'issued_at' => Carbon::now(), 'lock_version' => $exercice->lock_version + 1])->save();
                $this->audit->handle('charges.exercise.issued', subject: $exercice);
            }
        });
    }
}
