<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Push;

use App\Modules\Notifications\Data\PushMessage;
use App\Modules\Notifications\Enums\PushResult;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * FCM HTTP v1 : un seul pilote pour iOS (le SDK Firebase enveloppe APNs) et Android. Aucun jeton d'appareil ni contenu de message dans les journaux.
 */
final readonly class FcmDriver implements PushDriver
{
    public function __construct(private FcmAccessToken $acces) {}

    public function send(#[\SensitiveParameter] string $deviceToken, PushMessage $message): PushResult
    {
        $projet = config('notifications.push.fcm.project_id');

        if (! is_string($projet) || preg_match('/^[a-z0-9][a-z0-9-]{3,62}$/', $projet) !== 1) {
            Log::warning('Notifications push : projet FCM non configuré');

            return PushResult::Failed;
        }

        $jeton = $this->acces->get();

        if ($jeton === null) {
            return PushResult::Failed;
        }

        try {
            $reponse = Http::withToken($jeton)
                ->acceptJson()
                ->timeout(max(1, (int) config('notifications.push.fcm.timeout', 5)))
                ->post("https://fcm.googleapis.com/v1/projects/{$projet}/messages:send", ['message' => $this->payload($deviceToken, $message)]);
        } catch (ConnectionException) {
            Log::warning('Notifications push : FCM injoignable', ['notification_id' => $message->notificationId]);

            return PushResult::Failed;
        }

        if ($reponse->successful()) {
            return PushResult::Sent;
        }

        if ($reponse->status() === 404) {
            return PushResult::InvalidToken;
        }

        if ($reponse->status() === 401) {
            $this->acces->forget();
        }

        Log::warning('Notifications push : FCM a refusé le message', ['notification_id' => $message->notificationId, 'status' => $reponse->status()]);

        return PushResult::Failed;
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(string $deviceToken, PushMessage $message): array
    {
        return [
            'token' => $deviceToken,
            'notification' => ['title' => $message->title, 'body' => $message->body],
            'data' => array_filter(['notification_id' => $message->notificationId, 'link' => $message->link], fn (?string $valeur): bool => $valeur !== null),
            'android' => ['priority' => 'HIGH'],
            'apns' => ['headers' => ['apns-priority' => '10']],
        ];
    }
}
