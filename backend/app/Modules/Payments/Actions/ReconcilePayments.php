<?php

declare(strict_types=1);

namespace App\Modules\Payments\Actions;

use App\Modules\Payments\Enums\OnlinePaymentStatus;
use App\Modules\Payments\Events\PaymentConfirmed;
use App\Modules\Payments\Gateways\PaymentGateway;
use App\Modules\Payments\Models\OnlinePayment;
use App\Modules\Payments\Queries\OnlinePayments;
use App\Modules\Rent\PublicApi\RentLedger;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;

final readonly class ReconcilePayments
{
    public function __construct(
        private PaymentGateway $passerelle,
        private OnlinePayments $paiements,
        private ApplyOnlinePaymentStatus $statut,
        private RentLedger $loyers,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Rattrapage quotidien (ADR 0007) : relit au PSP, page après page, les intentions vivantes depuis plus de `reconcile_after_hours` (une intention que le PSP ignore encore après `expire_unknown_after_days` expire localement : un succès tardif l'emporte toujours), puis rejoue
     * `PaymentConfirmed` pour tout paiement confirmé que Rent n'a pas encore imputé (l'imputation est idempotente sur la clé du PSP).
     *
     * @return array{synced: int, replayed: int}
     */
    public function handle(CarbonImmutable $now): array
    {
        $synced = 0;
        $replayed = 0;

        $avant = $now->subHours((int) config('payments.reconcile_after_hours'));
        $abandon = $now->subDays((int) config('payments.expire_unknown_after_days'));
        $lot = max(1, (int) config('payments.reconcile_batch'));
        $dernier = null;

        do {
            $page = $this->paiements->liveBefore($avant, $dernier, $lot);

            foreach ($page as $paiement) {
                $dernier = $paiement->id;

                if ($paiement->provider !== $this->passerelle->name()) {
                    continue;
                }

                $etat = $this->passerelle->fetch((string) $paiement->provider_reference);

                if ($etat === null) {
                    if ($paiement->created_at < $abandon && $this->statut->handle($paiement, OnlinePaymentStatus::Expired)) {
                        $synced++;
                    }

                    continue;
                }

                if ($this->statut->handle($paiement, $etat->status, null, $etat->amount, $etat->currency)) {
                    $synced++;
                }
            }
        } while (count($page) === $lot);

        foreach ($this->paiements->succeededSince($now->subDays((int) config('payments.replay_confirmed_days'))) as $paiement) {
            if (! $this->contexte->run($paiement->organization_id, fn (): bool => $this->loyers->isRecorded('psp:'.$paiement->provider.':'.$paiement->provider_reference))) {
                $this->replay($paiement, $now);
                $replayed++;
            }
        }

        return ['synced' => $synced, 'replayed' => $replayed];
    }

    private function replay(OnlinePayment $paiement, CarbonImmutable $now): void
    {
        Log::warning('Paiement en ligne confirmé non imputé : confirmation rejouée', ['online_payment_id' => $paiement->id]);
        PaymentConfirmed::dispatch($paiement->id, $paiement->organization_id, $paiement->lease_id, $paiement->party_id, $paiement->provider, (string) $paiement->provider_reference, (int) $paiement->amount->getAmount(), $paiement->currency, $paiement->method->value, ($paiement->confirmed_at ?? $now)->toDateString());
    }
}
