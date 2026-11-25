<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Models\InterventionEvent;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class AddComment
{
    public function __construct(
        private Locks $verrous,
        private Timeline $chronologie,
    ) {}

    /**
     * Commentaire de la chronologie à visibilité explicite : celui du locataire est vu de l'équipe et des colocataires du bail,
     * jamais du mandant ; celui de l'équipe n'est vu que de qui elle désigne. Clé d'idempotence facultative : même clé, même auteur
     * et même contenu rejoués donnent le commentaire déjà écrit ; même clé avec un autre contenu ou une autre intervention : 409.
     *
     * @return array{event: InterventionEvent, replayed: bool}
     */
    public function handle(string $interventionId, ActorKind $acteur, string $texte, bool $visibleLocataire, bool $visibleMandant, ?string $cle = null): array
    {
        $proprietaire = $acteur === ActorKind::Tenant ? false : $visibleMandant;
        $locataire = $acteur === ActorKind::Tenant ? true : $visibleLocataire;

        try {
            return DB::transaction(function () use ($interventionId, $acteur, $texte, $locataire, $proprietaire, $cle): array {
                $intervention = $this->verrous->intervention($interventionId);
                $rejeu = $cle === null ? null : $this->existing($cle, $intervention->id, $texte, $proprietaire, $locataire);

                if ($rejeu !== null) {
                    return ['event' => $rejeu, 'replayed' => true];
                }

                if ($acteur === ActorKind::Tenant && $intervention->status->isTerminal()) {
                    throw ErrorCode::TransitionInvalid->problem();
                }

                $evenement = $this->chronologie->add($intervention, EventKind::Comment, $acteur, $texte, proprietaire: $proprietaire, locataire: $locataire, idempotencyKey: $cle);

                return ['event' => $evenement, 'replayed' => false];
            });
        } catch (UniqueConstraintViolationException $erreur) {
            $rejeu = $cle === null ? null : $this->existing($cle, $interventionId, $texte, $proprietaire, $locataire);

            return $rejeu === null ? throw $erreur : ['event' => $rejeu, 'replayed' => true];
        }
    }

    private function existing(string $cle, string $interventionId, string $texte, bool $proprietaire, bool $locataire): ?InterventionEvent
    {
        $existant = InterventionEvent::query()->where('actor_user_id', auth()->id())->where('idempotency_key', $cle)->first();

        if ($existant === null) {
            return null;
        }

        if ($existant->intervention_id !== strtolower($interventionId) || $existant->text !== mb_substr($texte, 0, 500)
            || $existant->visible_to_owner !== $proprietaire || $existant->visible_to_tenant !== $locataire) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $existant;
    }
}
