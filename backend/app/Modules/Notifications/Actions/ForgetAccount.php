<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\PlatformCampaignStatus;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use App\Modules\Notifications\Models\PushToken;
use Illuminate\Support\Facades\DB;

final readonly class ForgetAccount
{
    public function __construct(private RevokePushTokens $revocation) {}

    /**
     * Compte supprimé (ADR 0004) : les appareils sont révoqués, les notifications archivées, l'empreinte d'adresse des campagnes de la
     * plateforme retirée, le compte ôté des brouillons ; aucune ligne n'est effacée.
     */
    public function handle(string $userId): void
    {
        $this->revocation->handle(PushToken::query()->where('user_id', $userId));
        Notification::query()->where('user_id', $userId)->whereNull('archived_at')->update(['archived_at' => now()]);

        DB::transaction(function () use ($userId): void {
            PlatformCampaignDelivery::query()->where('user_id', $userId)->update(['email_hash' => null]);

            foreach (PlatformCampaign::query()->where('status', PlatformCampaignStatus::Draft->value)->whereJsonContains('recipient_user_ids', $userId)->lockForUpdate()->get() as $campagne) {
                $campagne->forceFill(['recipient_user_ids' => array_values(array_diff($campagne->recipient_user_ids, [$userId]))])->save();
            }
        });
    }
}
