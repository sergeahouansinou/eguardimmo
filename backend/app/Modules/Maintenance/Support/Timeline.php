<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionEvent;

/**
 * Chronologie en ajout seul. Les textes système sont rendus en français à la création et jamais relus ; un texte visible du
 * locataire est générique et ne reprend jamais une donnée d'un tiers.
 */
final class Timeline
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function add(
        Intervention $intervention,
        EventKind $kind,
        ActorKind $acteur,
        ?string $texte = null,
        array $metadata = [],
        bool $proprietaire = false,
        bool $locataire = false,
    ): InterventionEvent {
        $utilisateur = auth()->id();

        return InterventionEvent::query()->create([
            'intervention_id' => $intervention->id,
            'kind' => $kind,
            'actor_kind' => $acteur,
            'actor_user_id' => $acteur === ActorKind::System || ! is_string($utilisateur) ? null : $utilisateur,
            'text' => $texte === null ? null : mb_substr($texte, 0, 500),
            'metadata' => $metadata === [] ? null : $metadata,
            'visible_to_owner' => $proprietaire,
            'visible_to_tenant' => $locataire,
        ]);
    }
}
