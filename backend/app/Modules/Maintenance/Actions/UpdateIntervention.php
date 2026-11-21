<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Data\UpdateInterventionData;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\Priority;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Support\Currencies;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Money\Money;

final readonly class UpdateIntervention
{
    private const ALLOWED = ['title', 'description', 'room', 'availability', 'priority', 'responsibility', 'due_on', 'estimated_amount', 'custom_fields'];

    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    public function handle(string $interventionId, UpdateInterventionData $donnees): Intervention
    {
        return DB::transaction(function () use ($interventionId, $donnees): Intervention {
            $intervention = $this->verrous->intervention($interventionId);
            $this->verrous->expectVersion($intervention, $donnees->lockVersion);

            if (! in_array($intervention->status, InterventionStatus::open(), true)) {
                throw ErrorCode::TransitionInvalid->problem();
            }

            $champs = array_intersect_key($donnees->fields, array_flip(self::ALLOWED));

            if (array_key_exists('estimated_amount', $champs)) {
                if ($intervention->status->value !== InterventionStatus::Reported->value && $intervention->status !== InterventionStatus::Qualified) {
                    throw ErrorCode::TransitionInvalid->problem('L\'estimation ne se modifie plus une fois l\'engagement pris.');
                }

                $champs['estimated_amount'] = $champs['estimated_amount'] === null ? null : new Money((int) $champs['estimated_amount'], Currencies::of($intervention->currency));
            }

            $avant = $intervention->priority->value;
            $apres = isset($champs['priority']) ? (string) ($champs['priority'] instanceof Priority ? $champs['priority']->value : $champs['priority']) : $avant;

            if ($apres === Priority::Urgent->value && $avant !== $apres) {
                throw ErrorCode::EmergencyNotAllowed->problem('La priorité urgente se pose à la qualification, pas par modification de la fiche.');
            }

            $this->transitions->apply($intervention, null, $champs);
            $this->chronologie->add($intervention, EventKind::Updated, ActorKind::Team, 'Fiche modifiée.');

            if ($apres !== $avant) {
                $this->audit->handle('maintenance.intervention.priority_changed', subject: $intervention, metadata: ['reference' => $intervention->reference, 'from' => $avant, 'to' => $apres]);
            }

            return $intervention;
        });
    }
}
