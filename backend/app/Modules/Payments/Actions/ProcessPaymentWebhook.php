<?php

declare(strict_types=1);

namespace App\Modules\Payments\Actions;

use App\Modules\Payments\Enums\ErrorCode;
use App\Modules\Payments\Gateways\PaymentGateway;
use App\Modules\Payments\Models\PaymentProviderEvent;
use App\Modules\Payments\Queries\OnlinePayments;
use Illuminate\Database\UniqueConstraintViolationException;

final readonly class ProcessPaymentWebhook
{
    public function __construct(
        private PaymentGateway $passerelle,
        private OnlinePayments $paiements,
        private ApplyOnlinePaymentStatus $statut,
    ) {}

    /**
     * Le corps n'est cru qu'après vérification de la signature sur le texte brut ; l'événement est unique sur (fournisseur, identifiant) :
     * un rejeu est acquitté sans second effet. Un événement sans paiement connu ou d'un type ignoré est acquitté aussi, pour que le PSP cesse de le renvoyer.
     */
    public function handle(string $fournisseur, string $corps, ?string $signature): void
    {
        if ($fournisseur !== $this->passerelle->name()) {
            throw ErrorCode::WebhookSignatureInvalid->problem();
        }

        $evenement = $this->passerelle->readWebhook($corps, $signature);

        try {
            $trace = PaymentProviderEvent::query()->create(['provider' => $fournisseur, 'event_id' => $evenement->eventId, 'type' => $evenement->type, 'received_at' => now()]);
        } catch (UniqueConstraintViolationException) {
            $trace = PaymentProviderEvent::query()->where('provider', $fournisseur)->where('event_id', $evenement->eventId)->firstOrFail();

            if ($trace->processed_at !== null) {
                return;
            }
        }

        if ($evenement->status !== null && $evenement->providerReference !== null) {
            $paiement = $this->paiements->byReference($fournisseur, $evenement->providerReference);

            if ($paiement !== null) {
                $this->statut->handle($paiement, $evenement->status, $evenement->failureCode, $evenement->amount, $evenement->currency);
            }
        }

        $trace->forceFill(['processed_at' => now()])->save();
    }
}
