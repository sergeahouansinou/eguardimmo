<?php

declare(strict_types=1);

namespace App\Modules\Payments\Actions;

use App\Modules\Payments\Enums\OnlinePaymentStatus;
use App\Modules\Payments\Events\OnlinePaymentFailed;
use App\Modules\Payments\Events\PaymentConfirmed;
use App\Modules\Payments\Models\OnlinePayment;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

final readonly class ApplyOnlinePaymentStatus
{
    public function __construct(
        private CurrentOrganization $contexte,
        private RecordAudit $audit,
    ) {}

    /**
     * Fait avancer l'intention d'un état à un autre, sous verrou et sans retour en arrière. Un succès sans montant ni devise, ou dont le
     * montant ou la devise diffèrent de l'intention, n'est jamais cru : rien ne bouge, aucun encaissement, l'écart est journalisé et audité.
     * Vrai si l'état a changé.
     */
    public function handle(OnlinePayment $paiement, OnlinePaymentStatus $cible, ?string $failureCode = null, ?int $montantConfirme = null, ?string $deviseConfirmee = null): bool
    {
        return $this->contexte->run($paiement->organization_id, fn (): bool => DB::transaction(function () use ($paiement, $cible, $failureCode, $montantConfirme, $deviseConfirmee): bool {
            $verrouille = OnlinePayment::query()->whereKey($paiement->id)->lockForUpdate()->firstOrFail();

            if (! $verrouille->status->canBecome($cible)) {
                return false;
            }

            if ($cible === OnlinePaymentStatus::Succeeded) {
                $ecart = match (true) {
                    $montantConfirme === null || $deviseConfirmee === null => 'missing',
                    $montantConfirme !== (int) $verrouille->amount->getAmount() => 'amount',
                    strtoupper($deviseConfirmee) !== strtoupper($verrouille->currency) => 'currency',
                    default => null,
                };

                if ($ecart !== null) {
                    Log::critical('Succès du PSP sans montant ou devise concordants avec l\'intention', ['online_payment_id' => $verrouille->id, 'provider' => $verrouille->provider, 'reason' => $ecart]);
                    $this->audit->handle('payments.online_payment.mismatch', null, ['reason' => $ecart], $verrouille);

                    return false;
                }
            }

            $tardif = in_array($verrouille->status, [OnlinePaymentStatus::Cancelled, OnlinePaymentStatus::Expired], true);

            $verrouille->forceFill([
                'status' => $cible,
                'failure_code' => $cible === OnlinePaymentStatus::Failed ? ($failureCode ?? 'unknown') : $verrouille->failure_code,
                'confirmed_at' => $cible === OnlinePaymentStatus::Succeeded ? now() : $verrouille->confirmed_at,
            ])->save();

            $this->audit->handle('payments.online_payment.'.$cible->value, null, ['method' => $verrouille->method->value, ...($tardif ? ['late' => true] : [])], $verrouille);

            if ($cible === OnlinePaymentStatus::Succeeded) {
                PaymentConfirmed::dispatch($verrouille->id, $verrouille->organization_id, $verrouille->lease_id, $verrouille->party_id, $verrouille->provider, (string) $verrouille->provider_reference, (int) $verrouille->amount->getAmount(), $verrouille->currency, $verrouille->method->value, now()->toDateString());
            }

            if ($cible === OnlinePaymentStatus::Failed) {
                OnlinePaymentFailed::dispatch($verrouille->id, $verrouille->organization_id, $verrouille->lease_id, $verrouille->party_id);
            }

            return true;
        }));
    }
}
