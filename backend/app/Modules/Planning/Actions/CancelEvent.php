<?php

declare(strict_types=1);

namespace App\Modules\Planning\Actions;

use App\Modules\Planning\Enums\ErrorCode;
use App\Modules\Planning\Models\PlanningEvent;
use Illuminate\Support\Facades\DB;

final readonly class CancelEvent
{
    /**
     * Rien n'est supprimé : l'événement garde sa trace, disparaît des listes et ne sera plus rappelé.
     */
    public function handle(PlanningEvent $event): PlanningEvent
    {
        return DB::transaction(function () use ($event): PlanningEvent {
            $evenement = PlanningEvent::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();

            if ($evenement->cancelled_at !== null) {
                throw ErrorCode::EventCancelled->problem();
            }

            $evenement->forceFill(['cancelled_at' => now(), 'next_reminder_at' => null, 'lock_version' => $evenement->lock_version + 1])->save();

            return $evenement;
        });
    }
}
