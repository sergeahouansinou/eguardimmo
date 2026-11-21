<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Data\ItemInputData;
use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Jurisdictions\ChargeRulesRegistry;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Support\ExerciseItems;
use App\Modules\Charges\Support\ExercisePeriods;
use App\Modules\Charges\Support\Locks;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class UpdateExercise
{
    public function __construct(
        private Locks $verrous,
        private ExercisePeriods $periodes,
        private ExerciseItems $postes,
        private ChargeRulesRegistry $juridictions,
        private OrganizationDirectory $organisation,
        private RecordAudit $audit,
    ) {}

    /**
     * Changer la période refait le prorata des sources : les postes se renvoient alors avec elle. Tout remplacement écarte l'aperçu calculé.
     *
     * @param  list<ItemInputData>|null  $postes
     */
    public function handle(string $id, int $lockVersion, ?string $periodStart, ?string $periodEnd, ?array $postes): ChargeExercise
    {
        return DB::transaction(function () use ($id, $lockVersion, $periodStart, $periodEnd, $postes): ChargeExercise {
            $exercice = $this->verrous->exerciseOfProperty($id);

            if (! $exercice->status->isEditable()) {
                throw ErrorCode::ExerciseStateInvalid->problem();
            }

            if ($exercice->lock_version !== $lockVersion) {
                throw ErrorCode::StaleVersion->problem();
            }

            $debut = $periodStart === null ? CarbonImmutable::parse($exercice->period_start)->startOfDay() : CarbonImmutable::parse($periodStart)->startOfDay();
            $fin = $periodEnd === null ? CarbonImmutable::parse($exercice->period_end)->startOfDay() : CarbonImmutable::parse($periodEnd)->startOfDay();
            $change = ! $debut->isSameDay($exercice->period_start) || ! $fin->isSameDay($exercice->period_end);

            if ($change && $postes === null) {
                throw ErrorCode::ItemInvalid->problem('Un changement de période demande de renvoyer les postes : leurs sources sont proratisées sur la nouvelle période.');
            }

            if ($change) {
                $this->periodes->assertValid($debut, $fin, CarbonImmutable::today());
                $this->periodes->assertFree($exercice->property_id, $debut, $fin, $exercice->id);
                $exercice->forceFill(['period_start' => $debut->toDateString(), 'period_end' => $fin->toDateString()])->save();
            }

            if ($postes !== null) {
                $this->postes->replace($exercice, $postes, $this->juridictions->for($exercice->jurisdiction), $this->organisation->currency()->getCode());
                $this->audit->handle('charges.exercise.items_replaced', subject: $exercice, metadata: ['items' => count($postes)]);
            }

            return $exercice->refresh();
        });
    }
}
