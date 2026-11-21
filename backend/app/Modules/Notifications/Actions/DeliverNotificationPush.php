<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Data\PushMessage;
use App\Modules\Notifications\Enums\PushResult;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\PushToken;
use App\Modules\Notifications\Push\PushChannel;
use App\Modules\Notifications\Queries\ActivePushTokens;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Throwable;

final readonly class DeliverNotificationPush
{
    public const string TITRE = 'eGuardImmo';

    public function __construct(
        private PushChannel $canal,
        private ActivePushTokens $jetons,
        private RevokePushTokens $revocation,
    ) {}

    /**
     * Ne lève jamais : un push est un plus, son échec ne bloque ni le centre ni l'e-mail. Contenu générique, jamais de
     * montant ni de nom. Au-delà du plafond horaire du compte, le push est omis.
     */
    public function handle(string $notificationId): void
    {
        $notification = Notification::query()->find($notificationId);

        if ($notification === null || ! $notification->push || $notification->pushed_at !== null || ! $this->canal->enabled()) {
            return;
        }

        $plafond = max(1, (int) config('notifications.push.per_user_per_hour', 20));

        if (! RateLimiter::attempt("notifications:push:{$notification->user_id}", $plafond, fn (): bool => true, 3600)) {
            Log::info('Notifications push : plafond horaire atteint', ['notification_id' => $notification->id]);

            return;
        }

        $message = new PushMessage(self::TITRE, $notification->type->pushBody(), $notification->id, $notification->link);
        $envoyes = 0;

        foreach ($this->jetons->for($notification->user_id) as $appareil) {
            $resultat = $this->send($appareil, $message);

            if ($resultat === PushResult::Sent) {
                $envoyes++;
            } elseif ($resultat === PushResult::InvalidToken) {
                $this->revocation->handle(PushToken::query()->whereKey($appareil->id));
            }
        }

        if ($envoyes > 0) {
            $notification->pushed_at = CarbonImmutable::now();
            $notification->save();
        }
    }

    private function send(PushToken $appareil, PushMessage $message): PushResult
    {
        try {
            return $this->canal->send($appareil, $message);
        } catch (Throwable) {
            Log::warning('Notifications push : envoi interrompu', ['notification_id' => $message->notificationId]);

            return PushResult::Failed;
        }
    }
}
