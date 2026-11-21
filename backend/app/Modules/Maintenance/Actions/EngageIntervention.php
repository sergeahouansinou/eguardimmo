<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Data\EngageData;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ApprovalBasis;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\Priority;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Support\Committed;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Notices;
use App\Modules\Maintenance\Support\Operators;
use App\Modules\Maintenance\Support\Settings;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class EngageIntervention
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private Operators $operateurs,
        private Committed $engage,
        private Notices $avis,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    /**
     * Engage les travaux sans devis à accepter : estimation sous le plafond du mandat, urgence tracée ou décision seule du bailleur
     * autonome. Un engagement au-dessus du plafond passe par l'accord du mandant, jamais par cette action.
     */
    public function handle(string $interventionId, EngageData $donnees): Intervention
    {
        return DB::transaction(function () use ($interventionId, $donnees): Intervention {
            $intervention = $this->verrous->intervention($interventionId);
            $this->verrous->expectVersion($intervention, $donnees->lockVersion);
            $this->transitions->assertIn($intervention, InterventionStatus::Qualified, InterventionStatus::Quoting);

            $base = $this->operateurs->isIndividualOrganization() ? ApprovalBasis::SelfManaged : (ApprovalBasis::tryFrom($donnees->basis) ?? throw ErrorCode::ApprovalRequired->problem());

            if ($base === ApprovalBasis::OwnerApproved) {
                throw ErrorCode::ApprovalRequired->problem();
            }

            if ($base === ApprovalBasis::Emergency) {
                if ($intervention->priority !== Priority::Urgent || $donnees->reason === null || trim($donnees->reason) === '') {
                    throw ErrorCode::EmergencyNotAllowed->problem();
                }

                $estime = $this->engage->amount($intervention);

                if ($estime !== null && $estime > Settings::emergencyCeilingMinor()) {
                    throw ErrorCode::EmergencyNotAllowed->problem('Le montant dépasse le plafond de la dérogation d\'urgence : l\'accord du mandant est nécessaire.');
                }
            } elseif ($base === ApprovalBasis::UnderCeiling) {
                $plafond = $intervention->ceiling_amount === null ? null : (int) $intervention->ceiling_amount->getAmount();
                $montant = $this->engage->amount($intervention);

                if ($plafond === null || $montant === null || $montant > $plafond) {
                    throw ErrorCode::ApprovalRequired->problem();
                }
            }

            $this->transitions->apply($intervention, InterventionStatus::Approved, [
                'approval_basis' => $base,
                'emergency_reason' => $base === ApprovalBasis::Emergency ? $donnees->reason : null,
            ]);

            $this->chronologie->add($intervention, $base === ApprovalBasis::Emergency ? EventKind::EmergencyEngaged : EventKind::Approved, ActorKind::Team, $base === ApprovalBasis::Emergency ? 'Engagement en urgence.' : 'Travaux engagés.');

            if ($base === ApprovalBasis::Emergency) {
                $this->audit->handle('maintenance.emergency.override', subject: $intervention, metadata: ['reference' => $intervention->reference, 'priority' => $intervention->priority->value]);
                $this->avis->emergency($intervention);
            }

            $this->audit->handle('maintenance.intervention.approved', subject: $intervention, metadata: ['reference' => $intervention->reference, 'basis' => $base->value]);

            return $intervention;
        });
    }
}
