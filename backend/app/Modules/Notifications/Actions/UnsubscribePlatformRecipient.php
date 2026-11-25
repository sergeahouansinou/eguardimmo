<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Data\PreferenceChange;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class UnsubscribePlatformRecipient
{
    public function __construct(
        private SavePreferences $preferences,
        private RecordAudit $audit,
    ) {}

    /**
     * Coupe l'e-mail de la catégorie de la campagne pour le compte (ADR 0042). Le rejouer ne change rien, sauf si le compte a réactivé
     * ce canal entre-temps : le lien le coupe de nouveau.
     */
    public function handle(string $envoiId): void
    {
        DB::transaction(function () use ($envoiId): void {
            $envoi = PlatformCampaignDelivery::query()->whereKey($envoiId)->lockForUpdate()->firstOrFail();
            $campagne = PlatformCampaign::query()->findOrFail($envoi->campaign_id);
            $this->preferences->handle($envoi->user_id, [new PreferenceChange($campagne->category->notificationType(), NotificationChannel::Email, false)]);

            if ($envoi->unsubscribed_at === null) {
                $envoi->forceFill(['unsubscribed_at' => now()])->save();
                $this->audit->handle('notifications.mail.unsubscribed', metadata: ['campaign_id' => $envoi->campaign_id], subject: $envoi);
            }
        });
    }
}
