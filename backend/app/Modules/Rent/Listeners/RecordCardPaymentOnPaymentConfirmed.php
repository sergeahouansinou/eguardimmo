<?php

declare(strict_types=1);

namespace App\Modules\Rent\Listeners;

use App\Modules\Payments\Events\PaymentConfirmed;
use App\Modules\Rent\Actions\RecordPayment;
use App\Modules\Rent\Data\NewPaymentData;
use App\Modules\Rent\Enums\PaymentMethod;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;
use Throwable;

final class RecordCardPaymentOnPaymentConfirmed implements ShouldQueue
{
    public int $tries = 5;

    /**
     * @return list<int>
     */
    public function backoff(): array
    {
        return [30, 120, 600, 1800];
    }

    public function __construct(
        private readonly CurrentOrganization $contexte,
        private readonly RecordPayment $encaissement,
        private readonly RecordAudit $audit,
    ) {}

    /**
     * Idempotent : la clé `psp:{fournisseur}:{référence}` rejoue le même encaissement sans le doubler ; `payments:reconcile`
     * rejoue l'événement d'un paiement confirmé et non imputé (ADR 0007).
     */
    public function handle(PaymentConfirmed $evenement): void
    {
        $this->contexte->run($evenement->organizationId, function () use ($evenement): void {
            $this->encaissement->handle(new NewPaymentData(
                $evenement->leaseId,
                $evenement->amount,
                PaymentMethod::from($evenement->method),
                $evenement->confirmedOn,
                $evenement->providerReference,
                null,
                $evenement->idempotencyKey(),
                $evenement->provider.':'.$evenement->providerReference,
                $evenement->partyId,
            ), CarbonImmutable::today());
        });
    }

    /**
     * Encaissement refusé après toutes les tentatives : l'argent a été perçu par le PSP mais rien n'est imputé. L'alerte est auditée
     * dans l'organisation et journalisée, pour que l'équipe la voie avant le rejeu de `payments:reconcile`.
     */
    public function failed(PaymentConfirmed $evenement, Throwable $erreur): void
    {
        Log::critical('Paiement en ligne confirmé mais refusé par Rent', ['online_payment_id' => $evenement->onlinePaymentId, 'lease_id' => $evenement->leaseId, 'error' => $erreur::class]);

        $this->contexte->run($evenement->organizationId, function () use ($evenement, $erreur): void {
            $this->audit->handle('rent.card_payment.rejected', null, ['online_payment_id' => $evenement->onlinePaymentId, 'lease_id' => $evenement->leaseId, 'error' => $erreur::class]);
        });
    }
}
