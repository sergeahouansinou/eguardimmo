<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Models\Intervention;

final class Transitions
{
    /**
     * Seul chemin de changement d'état : refuse toute transition hors du tableau de l'ADR 0029 et incrémente la version.
     *
     * @param  array<string, mixed>  $attributs
     */
    public function apply(Intervention $intervention, ?InterventionStatus $vers, array $attributs = []): Intervention
    {
        if ($vers !== null && ! $intervention->status->canGoTo($vers) && $intervention->status !== $vers) {
            throw ErrorCode::TransitionInvalid->problem();
        }

        $intervention->forceFill([
            ...$attributs,
            ...($vers === null ? [] : ['status' => $vers]),
            'lock_version' => $intervention->lock_version + 1,
        ])->save();

        return $intervention;
    }

    public function assertIn(Intervention $intervention, InterventionStatus ...$etats): void
    {
        if (! in_array($intervention->status, $etats, true)) {
            throw ErrorCode::TransitionInvalid->problem();
        }
    }
}
