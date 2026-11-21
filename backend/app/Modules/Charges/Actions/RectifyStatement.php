<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExerciseStatus;
use App\Modules\Charges\Enums\StatementStatus;
use App\Modules\Charges\Models\ChargeConsumption;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeItem;
use App\Modules\Charges\Models\ChargeItemSource;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Support\Idempotency;
use App\Modules\Charges\Support\Locks;
use App\Modules\Charges\Support\Operators;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RectifyStatement
{
    private const string SCOPE = 'statement.rectify';

    public function __construct(
        private Locks $verrous,
        private Idempotency $idempotence,
        private ComputeExercise $calcul,
        private Operators $operateurs,
        private RecordAudit $audit,
    ) {}

    /**
     * Ouvre un exercice partiel limité au bail, copie des postes de l'exercice d'origine, et en calcule le décompte rectificatif : l'équipe peut
     * encore corriger les postes avant de l'émettre ; son effet sera la différence avec le décompte rectifié, qui passe `superseded` à l'émission.
     */
    public function handle(string $statementId, string $motif, string $cle): ChargeExercise
    {
        $exerciceId = ChargeStatement::query()->whereKey($statementId)->value('exercise_id');

        if (! is_string($exerciceId)) {
            throw ErrorCode::StatementNotFound->problem();
        }

        return DB::transaction(function () use ($statementId, $exerciceId, $motif, $cle): ChargeExercise {
            $origine = $this->verrous->exerciseOfProperty($exerciceId);
            $decompte = $this->verrous->statement($statementId);
            $empreinte = Idempotency::fingerprint([$statementId, $motif]);
            $rejeu = $this->idempotence->replayed(self::SCOPE, $cle, $empreinte);

            if ($rejeu !== null) {
                return ChargeExercise::query()->whereKey($rejeu)->firstOrFail();
            }

            if ($decompte->status !== StatementStatus::Issued) {
                throw ErrorCode::StatementStateInvalid->problem('Seul un décompte émis se rectifie.');
            }

            $ouvert = ChargeExercise::query()->where('supersedes_statement_id', $decompte->id)->whereIn('status', [ExerciseStatus::Draft->value, ExerciseStatus::Computed->value, ExerciseStatus::Issuing->value])->exists();

            if ($ouvert) {
                throw ErrorCode::ExerciseStateInvalid->problem('Un rectificatif de ce décompte est déjà en cours.');
            }

            $nouveau = ChargeExercise::query()->create([
                'property_id' => $origine->property_id, 'period_start' => $origine->period_start->toDateString(), 'period_end' => $origine->period_end->toDateString(),
                'status' => ExerciseStatus::Draft, 'jurisdiction' => $origine->jurisdiction, 'only_lease_id' => $decompte->lease_id,
                'supersedes_statement_id' => $decompte->id, 'rectification_reason' => $motif, 'lock_version' => 1, 'created_by_user_id' => $this->operateurs->userId(),
            ]);
            $this->copyItems($origine, $nouveau);
            $this->calcul->handle($nouveau->id);
            $this->idempotence->remember(self::SCOPE, $cle, $empreinte, $nouveau->id);
            $this->audit->handle('charges.statement.rectified', subject: $decompte, metadata: ['exercise_id' => $nouveau->id]);

            return $nouveau->refresh();
        });
    }

    private function copyItems(ChargeExercise $origine, ChargeExercise $nouveau): void
    {
        foreach (ChargeItem::query()->where('exercise_id', $origine->id)->orderBy('position')->get() as $poste) {
            $copie = ChargeItem::query()->create([
                'exercise_id' => $nouveau->id, 'label' => $poste->label, 'rubric' => $poste->rubric, 'key_id' => $poste->key_id, 'unit_id' => $poste->unit_id,
                'amount' => $poste->amount, 'currency' => $poste->currency, 'position' => $poste->position,
            ]);

            foreach (ChargeItemSource::query()->where('item_id', $poste->id)->get() as $source) {
                ChargeItemSource::query()->create(['item_id' => $copie->id, 'exercise_id' => $nouveau->id, 'source_kind' => $source->source_kind, 'source_id' => $source->source_id, 'amount' => $source->amount]);
            }

            foreach (ChargeConsumption::query()->where('item_id', $poste->id)->get() as $consommation) {
                ChargeConsumption::query()->create(['item_id' => $copie->id, 'unit_id' => $consommation->unit_id, 'quantity_milli' => $consommation->quantity_milli]);
            }
        }
    }
}
