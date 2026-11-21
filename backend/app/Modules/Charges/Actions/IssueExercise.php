<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExerciseStatus;
use App\Modules\Charges\Enums\StatementStatus;
use App\Modules\Charges\Jurisdictions\ChargeRulesRegistry;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Support\Idempotency;
use App\Modules\Charges\Support\IssuanceOutcome;
use App\Modules\Charges\Support\Locks;
use App\Shared\Audit\RecordAudit;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Throwable;

final readonly class IssueExercise
{
    private const string SCOPE = 'exercise.issue';

    public function __construct(
        private Locks $verrous,
        private Idempotency $idempotence,
        private ChargeRulesRegistry $juridictions,
        private ComputeExercise $calcul,
        private IssueStatement $emission,
        private IssuanceOutcome $suites,
        private RecordAudit $audit,
    ) {}

    /**
     * Gèle les postes après un dernier recalcul, puis émet chaque décompte dans sa propre transaction : une panne n'arrête pas les autres baux.
     */
    public function handle(string $id, string $cle, bool $prescriptionAcknowledged): ChargeExercise
    {
        $exercice = DB::transaction(fn (): ChargeExercise => $this->freeze($id, $cle, $prescriptionAcknowledged));

        $aEmettre = ChargeStatement::query()->where('exercise_id', $id)->whereIn('status', [StatementStatus::Computed->value, StatementStatus::Failed->value])->orderBy('lease_id')->pluck('id')->all();

        foreach ($aEmettre as $decompteId) {
            try {
                $this->emission->handle((string) $decompteId);
            } catch (ApiProblem $erreur) {
                $this->suites->markFailed((string) $decompteId, $erreur->problemCode);
            } catch (Throwable $erreur) {
                report($erreur);
                $this->suites->markFailed((string) $decompteId, 'charges_issue_failed');
            }
        }

        $this->suites->finalize($id);

        return $exercice->refresh();
    }

    private function freeze(string $id, string $cle, bool $ack): ChargeExercise
    {
        $exercice = $this->verrous->exerciseOfProperty($id);
        $rejeu = $this->idempotence->replayed(self::SCOPE, $cle, Idempotency::fingerprint([$id, $ack]));

        if ($rejeu !== null) {
            return $exercice;
        }

        if (! $exercice->status->isEditable()) {
            throw ErrorCode::ExerciseStateInvalid->problem();
        }

        $this->assertPrescription($exercice, $ack);
        $this->calcul->handle($id);
        $exercice->refresh();
        $exercice->forceFill(['status' => ExerciseStatus::Issuing, 'prescription_acknowledged' => $ack, 'lock_version' => $exercice->lock_version + 1])->save();
        $this->idempotence->remember(self::SCOPE, $cle, Idempotency::fingerprint([$id, $ack]), $id);
        $this->audit->handle('charges.exercise.issuing', subject: $exercice);

        return $exercice;
    }

    private function assertPrescription(ChargeExercise $exercice, bool $ack): void
    {
        $aujourdhui = CarbonImmutable::today();
        $annees = $this->juridictions->for($exercice->jurisdiction)->prescriptionYears($aujourdhui);

        if (! CarbonImmutable::parse($exercice->period_end)->subDay()->addYears($annees)->lt($aujourdhui)) {
            return;
        }

        if (! $ack) {
            throw ErrorCode::PrescriptionAckRequired->problem(sprintf('La fin de cet exercice date de plus de %d ans : confirmez en connaissance de la prescription.', $annees));
        }

        $this->audit->handle('charges.prescription.acknowledged', subject: $exercice, metadata: ['years' => $annees]);
    }
}
