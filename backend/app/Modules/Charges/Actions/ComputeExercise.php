<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExerciseStatus;
use App\Modules\Charges\Jurisdictions\ChargeRulesRegistry;
use App\Modules\Charges\Models\ChargeItem;
use App\Modules\Charges\Support\ComputedExercise;
use App\Modules\Charges\Support\ComputeLoader;
use App\Modules\Charges\Support\ItemBases;
use App\Modules\Charges\Support\Locks;
use App\Modules\Charges\Support\StatementBuilder;
use App\Modules\Charges\Support\StatementStore;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final readonly class ComputeExercise
{
    public function __construct(
        private Locks $verrous,
        private ChargeRulesRegistry $juridictions,
        private ComputeLoader $chargement,
        private ItemBases $bases,
        private StatementBuilder $constructeur,
        private StatementStore $decomptes,
        private OrganizationDirectory $organisation,
        private RecordAudit $audit,
    ) {}

    /**
     * Aperçu recalculable : les décomptes `computed` précédents sont remplacés ; rien ne touche les comptes des locataires.
     */
    public function handle(string $id, ?int $lockVersion = null): ComputedExercise
    {
        return DB::transaction(function () use ($id, $lockVersion): ComputedExercise {
            $exercice = $this->verrous->exerciseOfProperty($id);

            if (! $exercice->status->isEditable()) {
                throw ErrorCode::ExerciseStateInvalid->problem();
            }

            if ($lockVersion !== null && $exercice->lock_version !== $lockVersion) {
                throw ErrorCode::StaleVersion->problem();
            }

            $postes = ChargeItem::query()->where('exercise_id', $exercice->id)->orderBy('position')->get();

            if ($postes->isEmpty()) {
                throw ErrorCode::ItemInvalid->problem('Ajoutez au moins un poste avant de calculer.');
            }

            $regles = $this->juridictions->for($exercice->jurisdiction);
            $entrees = $this->chargement->load($exercice, $regles);
            $bases = $this->bases->resolve($postes, $exercice, $entrees->occupiedUnitIds);
            $construits = $this->constructeur->build($exercice, $postes, $bases, $entrees, $this->organisation->currency()->getCode(), $regles->templateVersion());

            $retires = $this->decomptes->purgeComputed($exercice->id);
            $this->decomptes->insert($construits);
            $exercice->forceFill(['status' => ExerciseStatus::Computed, 'computed_at' => Carbon::now(), 'lock_version' => $exercice->lock_version + 1])->save();
            $this->audit->handle('charges.exercise.computed', subject: $exercice, metadata: ['statements' => count($construits), 'replaced' => $retires, 'excluded' => count($entrees->excluded)]);

            return new ComputedExercise($exercice->refresh(), count($construits), $entrees->excluded);
        });
    }
}
