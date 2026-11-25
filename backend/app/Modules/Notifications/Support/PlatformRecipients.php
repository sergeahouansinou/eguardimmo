<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\MarketingAudience;
use App\Modules\Notifications\Enums\MarketingChannel;
use App\Modules\Notifications\Enums\PlatformDeliveryStatus;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Queries\ActivePushTokens;
use App\Modules\Notifications\Queries\EffectivePreferences;
use App\Modules\Notifications\Queries\Suppressions;
use App\Shared\Audience\AudienceRegistry;
use App\Shared\Audit\RecordAudit;
use Generator;
use Illuminate\Support\Collection;

/**
 * Destinataires d'une campagne de la plateforme : des comptes confirmés, actifs et non supprimés, relus par paquets.
 */
final readonly class PlatformRecipients
{
    private const int CHUNK = 500;

    public function __construct(
        private AudienceRegistry $groupes,
        private EffectivePreferences $preferences,
        private Suppressions $oppositions,
        private ActivePushTokens $appareils,
        private RecordAudit $audit,
    ) {}

    /**
     * @return Generator<int, Collection<int, User>>
     */
    public function chunks(PlatformCampaign $campagne): Generator
    {
        $identifiants = $campagne->audience === MarketingAudience::Selected
            ? $campagne->recipient_user_ids
            : $this->groupes->accountIds($campagne->audience->value, $campagne->inactivity_days);
        $vus = [];
        $paquet = [];

        foreach ($identifiants as $id) {
            if (isset($vus[$id])) {
                continue;
            }

            $vus[$id] = true;
            $paquet[] = $id;

            if (count($paquet) === self::CHUNK) {
                yield $this->reachable($paquet);
                $paquet = [];
            }
        }

        if ($paquet !== []) {
            yield $this->reachable($paquet);
        }
    }

    /**
     * @param  list<string>  $ids
     * @return Collection<int, User>
     */
    public function reachable(array $ids): Collection
    {
        return User::query()->whereKey($ids)->whereNotNull('email_verified_at')->whereNull('suspended_at')->orderBy('id')->get(['id', 'email'])->toBase();
    }

    /**
     * @param  Collection<int, User>  $comptes
     * @return array<string, array{status: PlatformDeliveryStatus, error: string|null, hash: string|null}>
     */
    public function classify(PlatformCampaign $campagne, Collection $comptes): array
    {
        $ids = array_values($comptes->map(fn (User $compte): string => $compte->id)->all());
        $canaux = $this->preferences->channelsFor($ids, $campagne->category->notificationType());
        $email = $campagne->channel === MarketingChannel::Email;
        $empreintes = [];

        if ($email) {
            foreach ($comptes as $compte) {
                if (filter_var($compte->email, FILTER_VALIDATE_EMAIL, FILTER_FLAG_EMAIL_UNICODE) !== false) {
                    $empreintes[$compte->id] = $this->audit->fingerprint($compte->email);
                }
            }
        }

        $opposees = $this->oppositions->platform(array_values($empreintes));
        $equipes = $email ? [] : $this->appareils->usersWithDevice($ids);
        $verdicts = [];

        foreach ($ids as $id) {
            $empreinte = $empreintes[$id] ?? null;
            [$statut, $erreur] = match (true) {
                ! in_array($campagne->channel->notificationChannel(), $canaux[$id] ?? [], true) => [PlatformDeliveryStatus::Suppressed, 'no_consent'],
                $email && $empreinte === null => [PlatformDeliveryStatus::SkippedNoEmail, null],
                $email && isset($opposees[$empreinte]) => [PlatformDeliveryStatus::Suppressed, 'suppression'],
                ! $email && ! isset($equipes[$id]) => [PlatformDeliveryStatus::SkippedNoDevice, null],
                default => [PlatformDeliveryStatus::Queued, null],
            };
            $verdicts[$id] = ['status' => $statut, 'error' => $erreur, 'hash' => $empreinte];
        }

        return $verdicts;
    }
}
