<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Actions\RevokePushTokens;
use App\Modules\Notifications\Data\PushMessage;
use App\Modules\Notifications\Enums\NotificationAudience;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\PushResult;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Models\PushToken;
use App\Modules\Notifications\Push\PushChannel;
use App\Modules\Notifications\Queries\ActivePushTokens;
use App\Modules\Notifications\Queries\EffectivePreferences;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Push d'une campagne : titre et corps rédigés par l'opérateur, portés par une notification d'audience `account`.
 */
final readonly class PlatformCampaignPush
{
    public function __construct(
        private PushChannel $canal,
        private ActivePushTokens $appareils,
        private RevokePushTokens $revocation,
        private EffectivePreferences $preferences,
    ) {}

    /**
     * @return bool vrai si au moins un appareil a été servi
     */
    public function send(PlatformCampaign $campagne, string $userId, string $cle, string $prefixe = ''): bool
    {
        $type = $campagne->category->notificationType();
        $centre = in_array(NotificationChannel::InApp, $this->preferences->channelsFor([$userId], $type)[$userId] ?? [], true);
        $notification = Notification::query()->firstOrCreate(
            ['user_id' => $userId, 'type' => $type, 'dedup_key' => $cle],
            [
                'organization_id' => null,
                'audience' => NotificationAudience::Account,
                'title' => $prefixe.$campagne->push_title,
                'body' => (string) $campagne->push_body,
                'link' => $campagne->link,
                'in_app' => $centre,
                'email' => false,
                'push' => true,
            ],
        );
        $message = new PushMessage($prefixe.$campagne->push_title, (string) $campagne->push_body, $notification->id, $campagne->link);
        $servis = 0;

        foreach ($this->appareils->for($userId) as $appareil) {
            $resultat = $this->deliver($appareil, $message);

            if ($resultat === PushResult::Sent) {
                $servis++;
            } elseif ($resultat === PushResult::InvalidToken) {
                $this->revocation->handle(PushToken::query()->whereKey($appareil->id));
            }
        }

        if ($servis > 0) {
            Notification::query()->whereKey($notification->id)->update(['pushed_at' => now()]);
        }

        return $servis > 0;
    }

    private function deliver(PushToken $appareil, PushMessage $message): PushResult
    {
        try {
            return $this->canal->send($appareil, $message);
        } catch (Throwable) {
            Log::warning('Push de campagne : envoi interrompu', ['notification_id' => $message->notificationId]);

            return PushResult::Failed;
        }
    }
}
