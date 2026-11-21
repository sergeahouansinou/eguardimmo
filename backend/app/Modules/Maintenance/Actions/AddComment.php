<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Models\InterventionEvent;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use Illuminate\Support\Facades\DB;

final readonly class AddComment
{
    public function __construct(
        private Locks $verrous,
        private Timeline $chronologie,
    ) {}

    /**
     * Commentaire de la chronologie à visibilité explicite : celui du locataire est vu de l'équipe et des colocataires du bail,
     * jamais du mandant ; celui de l'équipe n'est vu que de qui elle désigne.
     */
    public function handle(string $interventionId, ActorKind $acteur, string $texte, bool $visibleLocataire, bool $visibleMandant): InterventionEvent
    {
        return DB::transaction(function () use ($interventionId, $acteur, $texte, $visibleLocataire, $visibleMandant): InterventionEvent {
            $intervention = $this->verrous->intervention($interventionId);

            if ($acteur === ActorKind::Tenant && $intervention->status->isTerminal()) {
                throw ErrorCode::TransitionInvalid->problem();
            }

            return $this->chronologie->add(
                $intervention,
                EventKind::Comment,
                $acteur,
                $texte,
                proprietaire: $acteur === ActorKind::Tenant ? false : $visibleMandant,
                locataire: $acteur === ActorKind::Tenant ? true : $visibleLocataire,
            );
        });
    }
}
