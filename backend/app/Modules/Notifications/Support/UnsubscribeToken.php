<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Jeton de désinscription signé (HMAC-SHA256) : identifiant de la ligne d'envoi et échéance. Le lien ne porte aucune adresse, aucune
 * destination libre : la route ne redirige nulle part.
 */
final class UnsubscribeToken
{
    public function issue(CampaignDelivery|PlatformCampaignDelivery $envoi): string
    {
        $this->assertKey();
        $charge = $this->encode($envoi->id.'.'.CarbonImmutable::now()->addDays((int) config('notifications.campaigns.unsubscribe_ttl_days'))->getTimestamp());

        return $charge.'.'.$this->signature($charge);
    }

    /**
     * @return string|null identifiant de la ligne d'envoi ; null si le jeton est mal formé, falsifié ou échu
     */
    public function deliveryId(string $jeton): ?string
    {
        if (! $this->hasKey()) {
            return null;
        }

        $parties = explode('.', $jeton);

        if (count($parties) !== 2 || $parties[0] === '' || ! hash_equals($this->signature($parties[0]), $parties[1])) {
            return null;
        }

        $contenu = explode('.', $this->decode($parties[0]));

        if (count($contenu) !== 2 || ! Str::isUuid($contenu[0]) || ! ctype_digit($contenu[1]) || (int) $contenu[1] < CarbonImmutable::now()->getTimestamp()) {
            return null;
        }

        return $contenu[0];
    }

    public function url(CampaignDelivery|PlatformCampaignDelivery $envoi): string
    {
        return url('/api/v1/mail/unsubscribe/'.$this->issue($envoi));
    }

    private function hasKey(): bool
    {
        $cle = config('notifications.campaigns.unsubscribe_key');

        return is_string($cle) && $cle !== '';
    }

    private function assertKey(): void
    {
        if (! $this->hasKey()) {
            throw new RuntimeException('MAIL_UNSUBSCRIBE_KEY doit être renseignée.');
        }
    }

    private function signature(string $charge): string
    {
        return hash_hmac('sha256', 'unsubscribe:'.$charge, (string) config('notifications.campaigns.unsubscribe_key'));
    }

    private function encode(string $texte): string
    {
        return rtrim(strtr(base64_encode($texte), '+/', '-_'), '=');
    }

    private function decode(string $texte): string
    {
        return (string) base64_decode(strtr($texte, '-_', '+/'), true);
    }
}
