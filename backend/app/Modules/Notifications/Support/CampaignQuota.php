<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Enums\DeliveryStatus;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignDelivery;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Cache\Lock as CacheLock;
use Illuminate\Contracts\Cache\Lock;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;

/**
 * Plafonds par organisation (ADR 0033, décision 10) : destinataires sur 24 heures et envois par heure. Les deux se vérifient, et la
 * diffusion se fige, sous un même verrou par organisation : deux envois simultanés ne se partagent jamais le même reste.
 */
final class CampaignQuota
{
    private const int ATTENTE_SECONDES = 5;

    private const int VERROU_SECONDES = 120;

    private ?Lock $verrou = null;

    /**
     * @template T
     *
     * @param  callable(): T  $appel
     * @return T
     */
    public function exclusive(string $organizationId, callable $appel): mixed
    {
        $verrou = Cache::lock('campaigns:quota:'.$organizationId, self::VERROU_SECONDES);

        try {
            $verrou->block(self::ATTENTE_SECONDES);
        } catch (LockTimeoutException) {
            throw ErrorCode::CampaignQuotaReached->problemWith(['Retry-After' => (string) self::ATTENTE_SECONDES]);
        }

        $this->verrou = $verrou;

        try {
            return $appel();
        } finally {
            $this->verrou = null;
            $verrou->release();
        }
    }

    /**
     * Le verrou expire seul : si l'opération a duré plus que sa durée, un autre envoi a pu le prendre et le reste n'est plus garanti.
     */
    public function assertAvailable(int $destinataires): void
    {
        if ($this->verrou !== null && ! ($this->verrou instanceof CacheLock && $this->verrou->isOwnedByCurrentProcess())) {
            throw ErrorCode::CampaignQuotaReached->problemWith(['Retry-After' => (string) self::ATTENTE_SECONDES]);
        }

        $limiteEnvois = (int) config('notifications.campaigns.hourly_sends');
        $limiteDestinataires = (int) config('notifications.campaigns.daily_recipients');
        $depuisUneHeure = Campaign::query()->where('sending_started_at', '>=', now()->subHour())->orderBy('sending_started_at')->pluck('sending_started_at');

        if ($depuisUneHeure->count() >= $limiteEnvois) {
            throw ErrorCode::CampaignQuotaReached->problemWith(['Retry-After' => (string) $this->secondesAvant($depuisUneHeure->first()?->addHour())]);
        }

        $envoyes = CampaignDelivery::query()
            ->whereIn('campaign_id', Campaign::query()->where('sending_started_at', '>=', now()->subDay())->select('id'))
            ->whereNotIn('status', [DeliveryStatus::SkippedNoEmail->value, DeliveryStatus::Suppressed->value])
            ->count();

        if ($envoyes + $destinataires > $limiteDestinataires) {
            $premier = Campaign::query()->where('sending_started_at', '>=', now()->subDay())->orderBy('sending_started_at')->value('sending_started_at');

            throw ErrorCode::CampaignQuotaReached->problemWith(['Retry-After' => (string) $this->secondesAvant($premier === null ? null : CarbonImmutable::parse($premier)->addDay())]);
        }
    }

    private function secondesAvant(?DateTimeInterface $date): int
    {
        return $date === null ? 3600 : max(1, $date->getTimestamp() - now()->getTimestamp());
    }
}
