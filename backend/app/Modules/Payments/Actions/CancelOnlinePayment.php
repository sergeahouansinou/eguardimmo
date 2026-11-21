<?php

declare(strict_types=1);

namespace App\Modules\Payments\Actions;

use App\Modules\Payments\Enums\ErrorCode;
use App\Modules\Payments\Enums\OnlinePaymentStatus;
use App\Modules\Payments\Gateways\PaymentGateway;
use App\Modules\Payments\Models\OnlinePayment;
use App\Shared\Tenancy\CurrentOrganization;

final readonly class CancelOnlinePayment
{
    public function __construct(
        private PaymentGateway $passerelle,
        private ApplyOnlinePaymentStatus $statut,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Seule une intention encore en attente s'annule ; rejouable. Un succès confirmé plus tard par le PSP l'emporte (l'argent a bougé).
     */
    public function handle(OnlinePayment $paiement): OnlinePayment
    {
        return $this->contexte->run($paiement->organization_id, function () use ($paiement): OnlinePayment {
            $courant = OnlinePayment::query()->findOrFail($paiement->id);

            if ($courant->status === OnlinePaymentStatus::Cancelled) {
                return $courant;
            }

            if ($courant->status !== OnlinePaymentStatus::Pending) {
                throw ErrorCode::PaymentNotCancellable->problem();
            }

            $this->passerelle->cancel((string) $courant->provider_reference);
            $this->statut->handle($courant, OnlinePaymentStatus::Cancelled);

            return OnlinePayment::query()->findOrFail($courant->id);
        });
    }
}
