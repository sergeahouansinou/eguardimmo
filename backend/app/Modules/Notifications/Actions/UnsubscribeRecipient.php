<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Enums\SuppressionReason;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Queries\DeliveryLookup;
use App\Modules\Notifications\Support\UnsubscribeToken;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class UnsubscribeRecipient
{
    public function __construct(
        private UnsubscribeToken $jetons,
        private DeliveryLookup $envois,
        private CurrentOrganization $organisation,
        private AddSuppression $suppression,
        private RecordAudit $audit,
    ) {}

    /**
     * Idempotent : l'adresse entre dans la liste d'opposition de l'organisation de la diffusion ; la rejouer ne change rien. Un jeton
     * falsifié, échu ou dont la ligne a disparu répond comme un jeton inconnu.
     */
    public function handle(string $jeton): void
    {
        $ligne = $this->jetons->deliveryId($jeton) === null ? null : $this->envois->byId((string) $this->jetons->deliveryId($jeton));

        if ($ligne === null || $ligne['email_hash'] === null) {
            throw ErrorCode::UnsubscribeTokenInvalid->problem();
        }

        $this->organisation->run($ligne['organization_id'], function () use ($ligne): void {
            DB::transaction(function () use ($ligne): void {
                $this->suppression->handle($ligne['organization_id'], (string) $ligne['email_hash'], SuppressionReason::Unsubscribed);
                $envoi = CampaignDelivery::query()->whereKey($ligne['id'])->lockForUpdate()->first();

                if ($envoi !== null && $envoi->unsubscribed_at === null) {
                    $envoi->forceFill(['unsubscribed_at' => now()])->save();
                    $this->audit->handle('notifications.mail.unsubscribed', metadata: ['campaign_id' => $ligne['campaign_id']], subject: $envoi);
                }
            });
        });
    }
}
