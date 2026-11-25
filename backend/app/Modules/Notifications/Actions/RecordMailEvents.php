<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\DeliveryStatus;
use App\Modules\Notifications\Enums\PlatformDeliveryStatus;
use App\Modules\Notifications\Enums\SuppressionReason;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Models\MailProviderEvent;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use App\Modules\Notifications\Queries\DeliveryLookup;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Applique les événements d'un fournisseur d'e-mail (corps non fiable, signature déjà vérifiée par l'appelant) : rebond définitif et plainte
 * entrent dans la liste d'opposition de la plateforme, la désinscription du fournisseur dans celle de l'organisation (ou, pour un envoi de
 * la plateforme, dans les préférences du compte, ADR 0042). Idempotent sur l'identifiant d'événement ; les ouvertures et clics ne sont ni
 * lus ni conservés (aucun suivi, ADR 0033).
 */
final readonly class RecordMailEvents
{
    private const int MAX_EVENTS = 500;

    private const array TYPES = ['bounce' => 'bounce', 'spam' => 'spam', 'unsubscribe' => 'unsubscribe', 'soft bounce' => 'soft_bounce', 'soft_bounce' => 'soft_bounce', 'delivery' => 'delivery', 'reject' => 'reject', 'suspension' => 'suspension'];

    public function __construct(
        private DeliveryLookup $envois,
        private AddSuppression $suppression,
        private CurrentOrganization $organisation,
        private FinalizeCampaign $cloture,
        private RecordAudit $audit,
        private UnsubscribePlatformRecipient $desinscription,
    ) {}

    /**
     * @param  list<mixed>  $evenements
     * @return array{processed: int, duplicates: int, ignored: int}
     */
    public function handle(string $fournisseur, array $evenements): array
    {
        $bilan = ['processed' => 0, 'duplicates' => 0, 'ignored' => 0];

        foreach (array_slice($evenements, 0, self::MAX_EVENTS) as $evenement) {
            $lu = $this->read($evenement);

            if ($lu === null) {
                $bilan['ignored']++;

                continue;
            }

            if (! $this->apply($fournisseur, $lu)) {
                $bilan['duplicates']++;

                continue;
            }

            $bilan['processed']++;
        }

        return $bilan;
    }

    /**
     * @return array{id: string, type: string, email: string|null, delivery: string|null, message: string|null}|null
     */
    private function read(mixed $evenement): ?array
    {
        if (! is_array($evenement) || ! is_string($evenement['event_id'] ?? null) || ! is_string($evenement['event'] ?? null)) {
            return null;
        }

        $type = self::TYPES[strtolower(trim($evenement['event']))] ?? null;
        $id = trim($evenement['event_id']);

        if ($type === null || $id === '' || strlen($id) > 100) {
            return null;
        }

        $variables = $evenement['custom_variables'] ?? null;
        $envoi = is_array($variables) && is_string($variables['delivery_id'] ?? null) && Str::isUuid($variables['delivery_id']) ? $variables['delivery_id'] : null;
        $email = is_string($evenement['email'] ?? null) && filter_var(trim($evenement['email']), FILTER_VALIDATE_EMAIL) !== false ? trim($evenement['email']) : null;
        $message = is_string($evenement['message_id'] ?? null) && strlen($evenement['message_id']) <= 255 ? $evenement['message_id'] : null;

        return ['id' => $id, 'type' => $type, 'email' => $email, 'delivery' => $envoi, 'message' => $message];
    }

    /**
     * @param  array{id: string, type: string, email: string|null, delivery: string|null, message: string|null}  $evenement
     * @return bool faux : événement déjà reçu
     */
    private function apply(string $fournisseur, array $evenement): bool
    {
        $ligne = ($evenement['delivery'] === null ? null : $this->envois->byId($evenement['delivery']))
            ?? ($evenement['message'] === null ? null : $this->envois->byProviderMessage($evenement['message']));
        $empreinte = $evenement['email'] === null ? null : $this->audit->fingerprint($evenement['email']);

        if ($ligne !== null && $empreinte !== null && $ligne['email_hash'] !== $empreinte) {
            $ligne = null;
        }

        try {
            DB::transaction(function () use ($fournisseur, $evenement, $ligne, $empreinte): void {
                MailProviderEvent::query()->create([
                    'provider' => $fournisseur,
                    'event_id' => $evenement['id'],
                    'type' => $evenement['type'],
                    'delivery_id' => $ligne['id'] ?? null,
                    'received_at' => now(),
                ]);
                $this->effects($evenement['type'], $empreinte, $ligne);
            });
        } catch (UniqueConstraintViolationException) {
            return false;
        }

        return true;
    }

    /**
     * @param  array{id: string, organization_id: string|null, campaign_id: string, email_hash: string|null}|null  $ligne
     */
    private function effects(string $type, ?string $empreinte, ?array $ligne): void
    {
        if ($empreinte === null) {
            return;
        }

        if ($type === 'bounce' || $type === 'reject') {
            $this->suppression->handle(null, $empreinte, SuppressionReason::Bounce);
            $this->markBounced($ligne);
        } elseif ($type === 'spam') {
            $this->suppression->handle(null, $empreinte, SuppressionReason::Complaint);
        } elseif ($type === 'unsubscribe' && $ligne !== null) {
            if ($ligne['organization_id'] === null) {
                $this->desinscription->handle($ligne['id']);
            } else {
                $this->suppression->handle($ligne['organization_id'], $empreinte, SuppressionReason::Unsubscribed);
            }
        }
    }

    /**
     * @param  array{id: string, organization_id: string|null, campaign_id: string, email_hash: string|null}|null  $ligne
     */
    private function markBounced(?array $ligne): void
    {
        if ($ligne === null) {
            return;
        }

        $maintenant = now()->format('Y-m-d H:i:s.u');

        if ($ligne['organization_id'] === null) {
            PlatformCampaignDelivery::query()->whereKey($ligne['id'])
                ->whereIn('status', [PlatformDeliveryStatus::Sent->value, PlatformDeliveryStatus::Sending->value, PlatformDeliveryStatus::Unknown->value])
                ->update(['status' => PlatformDeliveryStatus::Bounced->value, 'bounced_at' => $maintenant, 'updated_at' => $maintenant]);

            return;
        }

        $this->organisation->run($ligne['organization_id'], function () use ($ligne, $maintenant): void {
            CampaignDelivery::query()->whereKey($ligne['id'])
                ->whereIn('status', [DeliveryStatus::Sent->value, DeliveryStatus::Sending->value, DeliveryStatus::Unknown->value])
                ->update(['status' => DeliveryStatus::Bounced->value, 'bounced_at' => $maintenant, 'updated_at' => $maintenant]);
            $this->cloture->refreshFailures($ligne['campaign_id']);
        });
    }
}
