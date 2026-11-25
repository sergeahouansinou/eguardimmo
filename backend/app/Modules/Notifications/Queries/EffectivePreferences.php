<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Notifications\Enums\NotificationAudience;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Models\NotificationPreference;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Modules\Parties\PublicApi\OwnerLinks;
use App\Modules\Parties\PublicApi\PartyLinks;

/**
 * Valeur effective d'un canal : verrouillé = toujours actif, sinon le choix du compte, sinon le défaut du catalogue.
 */
final readonly class EffectivePreferences
{
    public function __construct(
        private MembershipDirectory $adhesions,
        private PartyLinks $liens,
        private OwnerLinks $proprietaires,
        private PlatformNotificationTypes $plateforme,
    ) {}

    /**
     * Canaux retenus pour chaque compte, sans ceux que la plateforme a coupés pour tous ; un canal verrouillé ne se coupe jamais.
     *
     * @param  list<string>  $userIds
     * @return array<string, list<NotificationChannel>>
     */
    public function channelsFor(array $userIds, NotificationType $type): array
    {
        if ($userIds === []) {
            return [];
        }

        $choix = [];

        foreach (NotificationPreference::query()->whereIn('user_id', $userIds)->where('type', $type->value)->get() as $preference) {
            $choix[$preference->user_id][$preference->channel->value] = $preference->enabled;
        }

        $retenus = [];
        $coupes = $this->plateforme->cutChannels($type);
        $ouverts = array_values(array_filter(
            NotificationChannel::cases(),
            fn (NotificationChannel $canal): bool => in_array($canal, $type->locked(), true) || ! in_array($canal->value, $coupes, true),
        ));

        foreach ($userIds as $userId) {
            $retenus[$userId] = array_values(array_filter(
                $ouverts,
                fn (NotificationChannel $canal): bool => $this->enabled($type, $canal, $choix[$userId][$canal->value] ?? null),
            ));
        }

        return $retenus;
    }

    /**
     * Matrice des types qui concernent le compte, avec l'état de chaque canal.
     *
     * @return list<array{type: NotificationType, channels: list<array{channel: NotificationChannel, enabled: bool, locked: bool}>}>
     */
    public function matrix(string $userId): array
    {
        $choix = [];

        foreach (NotificationPreference::query()->where('user_id', $userId)->get() as $preference) {
            $choix[$preference->type->value][$preference->channel->value] = $preference->enabled;
        }

        return array_map(fn (NotificationType $type): array => [
            'type' => $type,
            'channels' => array_map(fn (NotificationChannel $canal): array => [
                'channel' => $canal,
                'enabled' => $this->enabled($type, $canal, $choix[$type->value][$canal->value] ?? null),
                'locked' => in_array($canal, $type->locked(), true),
            ], NotificationChannel::cases()),
        ], $this->applicableTypes($userId));
    }

    /**
     * @return list<NotificationType>
     */
    private function applicableTypes(string $userId): array
    {
        $types = [];

        foreach (NotificationType::forAudience(NotificationAudience::Account) as $type) {
            $types[$type->value] = $type;
        }

        foreach ($this->adhesions->membershipsOf($userId) as $adhesion) {
            foreach (NotificationType::forRole($adhesion->role) as $type) {
                $types[$type->value] = $type;
            }
        }

        if ($this->liens->linkedTo($userId) !== []) {
            foreach (NotificationType::forAudience(NotificationAudience::Tenant) as $type) {
                $types[$type->value] = $type;
            }
        }

        if ($this->proprietaires->activeFor($userId) !== []) {
            foreach (NotificationType::forAudience(NotificationAudience::Owner) as $type) {
                $types[$type->value] = $type;
            }
        }

        return array_values(array_filter(NotificationType::cases(), fn (NotificationType $type): bool => isset($types[$type->value])));
    }

    private function enabled(NotificationType $type, NotificationChannel $canal, ?bool $choix): bool
    {
        if (in_array($canal, $type->locked(), true)) {
            return true;
        }

        return $choix ?? in_array($canal, $type->defaults(), true);
    }
}
