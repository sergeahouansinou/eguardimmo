<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Data\PreferenceChange;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Models\NotificationPlatformSetting;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class SaveNotificationTypes
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Tout ou rien : couper un canal verrouillé (ADR 0027) refuse l'ensemble.
     *
     * @param  list<PreferenceChange>  $changements
     */
    public function handle(array $changements, string $operateurId): void
    {
        foreach ($changements as $changement) {
            if (! $changement->enabled && in_array($changement->channel, $changement->type->locked(), true)) {
                throw ErrorCode::ChannelMandatory->problem();
            }
        }

        DB::transaction(function () use ($changements, $operateurId): void {
            foreach ($changements as $changement) {
                $cle = ['type' => $changement->type->value, 'channel' => $changement->channel->value];

                if ($changement->enabled) {
                    NotificationPlatformSetting::query()->where($cle)->delete();
                } else {
                    NotificationPlatformSetting::query()->firstOrCreate($cle);
                }
            }

            $this->audit->handle('console.notifications.types_updated', $operateurId, ['changes' => array_map(
                fn (PreferenceChange $changement): array => ['type' => $changement->type->value, 'channel' => $changement->channel->value, 'enabled' => $changement->enabled],
                $changements,
            )]);
        });
    }
}
