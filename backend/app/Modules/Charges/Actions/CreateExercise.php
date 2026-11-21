<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Data\ItemInputData;
use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExerciseStatus;
use App\Modules\Charges\Jurisdictions\ChargeRulesRegistry;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Support\ExerciseItems;
use App\Modules\Charges\Support\ExercisePeriods;
use App\Modules\Charges\Support\Locks;
use App\Modules\Charges\Support\Operators;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class CreateExercise
{
    public function __construct(
        private Locks $verrous,
        private ExercisePeriods $periodes,
        private ExerciseItems $postes,
        private UnitDirectory $lots,
        private ChargeRulesRegistry $juridictions,
        private OrganizationDirectory $organisation,
        private Operators $operateurs,
        private RecordAudit $audit,
    ) {}

    /**
     * @param  list<ItemInputData>  $postes
     */
    public function handle(string $propertyId, string $periodStart, string $periodEnd, array $postes): ChargeExercise
    {
        $debut = CarbonImmutable::parse($periodStart)->startOfDay();
        $fin = CarbonImmutable::parse($periodEnd)->startOfDay();

        return DB::transaction(function () use ($propertyId, $debut, $fin, $postes): ChargeExercise {
            $this->verrous->property($propertyId);
            $this->periodes->assertValid($debut, $fin, CarbonImmutable::today());
            $juridiction = $this->jurisdiction($propertyId);
            $regles = $this->juridictions->for($juridiction);
            $this->periodes->assertFree($propertyId, $debut, $fin);

            $exercice = ChargeExercise::query()->create([
                'property_id' => $propertyId, 'period_start' => $debut->toDateString(), 'period_end' => $fin->toDateString(), 'status' => ExerciseStatus::Draft,
                'jurisdiction' => $juridiction, 'lock_version' => 0, 'created_by_user_id' => $this->operateurs->userId(),
            ]);
            $this->postes->replace($exercice, $postes, $regles, $this->organisation->currency()->getCode());
            $this->audit->handle('charges.exercise.created', subject: $exercice, metadata: ['items' => count($postes)]);

            return $exercice->refresh();
        });
    }

    private function jurisdiction(string $propertyId): string
    {
        $lots = $this->lots->ofProperty($propertyId);

        return $lots === [] ? throw ErrorCode::JurisdictionUnsupported->problem('Ce bien n\'a aucun lot : sa juridiction est inconnue.') : strtoupper($lots[0]->address['country']);
    }
}
