<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\VisitStatus;
use App\Modules\Maintenance\Models\InterventionVisit;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use App\Modules\Maintenance\Support\VisitFlow;
use Illuminate\Support\Facades\DB;

final readonly class CloseVisit
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private VisitFlow $visites,
        private Timeline $chronologie,
    ) {}

    /**
     * Issue d'une visite : effectuée (l'intervention passe en cours), annulée ou absence du prestataire (retour à « approuvée »
     * sans autre visite confirmée).
     */
    public function handle(string $interventionId, string $visitId, VisitStatus $issue): InterventionVisit
    {
        $sources = match ($issue) {
            VisitStatus::Done, VisitStatus::NoShow => [VisitStatus::Confirmed],
            VisitStatus::Cancelled => [VisitStatus::Proposed, VisitStatus::Confirmed, VisitStatus::RescheduleRequested],
            default => throw ErrorCode::VisitStatusInvalid->problem(),
        };

        return DB::transaction(function () use ($interventionId, $visitId, $issue, $sources): InterventionVisit {
            $intervention = $this->verrous->intervention($interventionId);
            $visite = $this->visites->lock($visitId, $interventionId);

            if (! in_array($visite->status, $sources, true)) {
                throw ErrorCode::VisitStatusInvalid->problem();
            }

            $visite->forceFill(['status' => $issue, 'lock_version' => $visite->lock_version + 1])->save();

            if ($issue === VisitStatus::Done) {
                $this->transitions->assertIn($intervention, InterventionStatus::Scheduled, InterventionStatus::InProgress);

                if ($intervention->status === InterventionStatus::Scheduled) {
                    $this->transitions->apply($intervention, InterventionStatus::InProgress);
                    $this->chronologie->add($intervention, EventKind::Started, ActorKind::Team, 'Intervention en cours.', locataire: true);
                }

                $this->chronologie->add($intervention, EventKind::VisitDone, ActorKind::Team, 'Visite effectuée.', metadata: ['visit_id' => $visite->id]);

                return $visite;
            }

            $this->visites->fallBack($intervention, $this->transitions);
            $this->chronologie->add(
                $intervention,
                $issue === VisitStatus::Cancelled ? EventKind::VisitCancelled : EventKind::VisitNoShow,
                ActorKind::Team,
                $issue === VisitStatus::Cancelled ? 'Rendez-vous annulé.' : 'Prestataire absent.',
                metadata: ['visit_id' => $visite->id],
                locataire: $issue === VisitStatus::Cancelled,
            );

            return $visite;
        });
    }
}
