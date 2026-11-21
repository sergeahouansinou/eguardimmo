<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Data\PreferenceChange;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Models\NotificationPreference;
use Illuminate\Support\Facades\DB;

final readonly class SavePreferences
{
    /**
     * Tout ou rien : un canal verrouillé qu'on tente de désactiver refuse l'ensemble. Activer un canal verrouillé est sans effet (il l'est déjà).
     *
     * @param  list<PreferenceChange>  $changements
     */
    public function handle(string $userId, array $changements): void
    {
        foreach ($changements as $changement) {
            if (! $changement->enabled && in_array($changement->channel, $changement->type->locked(), true)) {
                throw ErrorCode::ChannelMandatory->problem();
            }
        }

        DB::transaction(function () use ($userId, $changements): void {
            foreach ($changements as $changement) {
                if (in_array($changement->channel, $changement->type->locked(), true)) {
                    continue;
                }

                NotificationPreference::query()->updateOrCreate(
                    ['user_id' => $userId, 'type' => $changement->type->value, 'channel' => $changement->channel->value],
                    ['enabled' => $changement->enabled],
                );
            }
        });
    }
}
