<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Data\PreferenceChange;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Models\NotificationPreference;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class SavePreferences
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Tout ou rien : un canal verrouillé qu'on tente de désactiver refuse l'ensemble. Activer un canal verrouillé est sans effet (il l'est déjà).
     * Chaque changement de l'accord marketing est journalisé (ADR 0042).
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

                if ($changement->type === NotificationType::AccountMarketing) {
                    $this->recordConsent($userId, $changement);
                }

                NotificationPreference::query()->updateOrCreate(
                    ['user_id' => $userId, 'type' => $changement->type->value, 'channel' => $changement->channel->value],
                    ['enabled' => $changement->enabled],
                );
            }
        });
    }

    private function recordConsent(string $userId, PreferenceChange $changement): void
    {
        $avant = NotificationPreference::query()
            ->where(['user_id' => $userId, 'type' => $changement->type->value, 'channel' => $changement->channel->value])
            ->lockForUpdate()->first()->enabled ?? in_array($changement->channel, $changement->type->defaults(), true);

        if ($avant !== $changement->enabled) {
            $this->audit->handle('notifications.marketing_consent.changed', $userId, [
                'channel' => $changement->channel->value,
                'enabled' => $changement->enabled,
            ], User::query()->find($userId));
        }
    }
}
