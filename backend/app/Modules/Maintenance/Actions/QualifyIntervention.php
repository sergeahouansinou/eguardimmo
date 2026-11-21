<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Maintenance\Data\QualifyData;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\Priority;
use App\Modules\Maintenance\Events\InterventionQualified;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Support\Currencies;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Operators;
use App\Modules\Maintenance\Support\Placements;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Money\Money;

final readonly class QualifyIntervention
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private Placements $placements,
        private Operators $operateurs,
        private TermDirectory $termes,
        private UnitDirectory $lots,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    /**
     * Fige nature, priorité, responsabilité, bien, mandat et plafond du jour : un avenant ultérieur ne change pas la demande.
     */
    public function handle(string $interventionId, QualifyData $donnees): Intervention
    {
        return DB::transaction(function () use ($interventionId, $donnees): Intervention {
            $intervention = $this->verrous->intervention($interventionId);
            $this->verrous->expectVersion($intervention, $donnees->lockVersion);
            $this->transitions->assertIn($intervention, InterventionStatus::Reported);

            $lotId = $donnees->unitId ?? $intervention->unit_id;
            $bien = $intervention->property_id;

            if ($donnees->unitId !== null) {
                $bien = $this->lots->find($donnees->unitId)->propertyId;
            }

            $communes = $donnees->commonArea || $lotId === null;
            $lotId = $communes ? null : $lotId;
            $nature = $donnees->natureTermId === null ? $intervention->nature_term_id : $this->termes->findAssignable($donnees->natureTermId, VocabularyKey::InterventionNature)->id;
            $autonome = $this->operateurs->isIndividualOrganization();
            $placement = $this->placements->resolve($lotId, $bien, $donnees->mandateId ?? $intervention->mandate_id, CarbonImmutable::today(), $autonome, $donnees->priority === Priority::Urgent);

            $this->transitions->apply($intervention, InterventionStatus::Qualified, [
                'nature_term_id' => $nature,
                'priority' => $donnees->priority,
                'responsibility' => $donnees->responsibility,
                'property_id' => $placement->propertyId ?? $bien,
                'unit_id' => $placement->unitId,
                'mandate_id' => $placement->mandateId,
                'mandant_party_id' => $placement->mandantPartyId,
                'ceiling_amount' => $placement->ceiling === null || $placement->currency === null ? null : new Money($placement->ceiling, Currencies::of($placement->currency)),
                'due_on' => $donnees->dueOn,
                'estimated_amount' => $donnees->estimatedAmount === null ? null : new Money($donnees->estimatedAmount, Currencies::of($intervention->currency)),
                'room' => $donnees->room ?? $intervention->room,
                'custom_fields' => $donnees->customFields ?? $intervention->custom_fields,
            ]);

            $this->chronologie->add($intervention, EventKind::Qualified, ActorKind::Team, 'Demande qualifiée.', locataire: false);
            $this->chronologie->add($intervention, EventKind::Updated, ActorKind::System, 'Votre demande a été prise en charge.', locataire: true);
            $this->audit->handle('maintenance.intervention.qualified', subject: $intervention, metadata: ['reference' => $intervention->reference, 'priority' => $donnees->priority->value]);
            InterventionQualified::dispatch($intervention->id, $intervention->organization_id, $intervention->lease_id, $intervention->reference);

            return $intervention;
        });
    }
}
