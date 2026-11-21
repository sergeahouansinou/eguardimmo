<?php

declare(strict_types=1);

namespace App\Modules\Payments\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Data\TenantStandingData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Payments\Data\CheckoutRequestData;
use App\Modules\Payments\Enums\ErrorCode;
use App\Modules\Payments\Enums\OnlinePaymentMethod;
use App\Modules\Payments\Enums\OnlinePaymentStatus;
use App\Modules\Payments\Enums\PaymentAccountStatus;
use App\Modules\Payments\Gateways\PaymentGateway;
use App\Modules\Payments\Models\OnlinePayment;
use App\Modules\Payments\Models\PaymentAccount;
use App\Modules\Payments\Queries\CoveredInstallments;
use App\Modules\Rent\PublicApi\RentLedger;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Currency;
use Money\Money;

final readonly class CreateOnlinePayment
{
    public function __construct(
        private PaymentGateway $passerelle,
        private RentLedger $loyers,
        private LeaseDirectory $baux,
        private CoveredInstallments $couvertes,
        private CurrentOrganization $contexte,
        private RecordAudit $audit,
    ) {}

    /**
     * Le montant est le reste dû des échéances choisies, lu au grand livre : jamais une valeur du client. Une intention vivante par
     * (bail, fiche, ensemble d'échéances) : la même demande la rend (200), de même qu'une même clé `client_id`. Si le PSP ne répond pas,
     * rien n'est écrit (503).
     *
     * @param  list<string>  $installmentIds
     * @return array{payment: OnlinePayment, replayed: bool}
     */
    public function handle(TenantStandingData $position, User $user, array $installmentIds, OnlinePaymentMethod $method, string $clientId): array
    {
        return $this->contexte->run($position->organizationId, function () use ($position, $user, $installmentIds, $method, $clientId): array {
            $ids = array_values(array_unique($installmentIds));
            sort($ids);
            $empreinte = hash('sha256', implode(',', $ids));

            $existant = $this->existing($position, $clientId, $empreinte);

            if ($existant !== null) {
                return $this->replay($existant, $position, $empreinte, $method, $clientId);
            }

            if (! in_array($method->value, (array) config('payments.methods'), true)) {
                throw ErrorCode::PaymentMethodUnsupported->problem();
            }

            if ($this->passerelle->name() === 'none') {
                throw ErrorCode::PaymentProviderUnavailable->problem();
            }

            $compte = PaymentAccount::query()->where('provider', $this->passerelle->name())->first();

            if ($compte === null || $compte->status !== PaymentAccountStatus::Ready) {
                throw ErrorCode::PaymentAccountNotReady->problem();
            }

            try {
                return DB::transaction(function () use ($position, $user, $ids, $empreinte, $method, $clientId, $compte): array {
                    $this->baux->lock($position->leaseId);

                    $existant = $this->existing($position, $clientId, $empreinte);

                    if ($existant !== null) {
                        return $this->replay($existant, $position, $empreinte, $method, $clientId);
                    }

                    $this->assertNotCovered($position->leaseId, $ids);

                    $total = $this->total($position, $ids);
                    $id = Str::uuid7()->toString();
                    $session = $this->passerelle->createCheckout(new CheckoutRequestData($id, $compte->provider_account_id, (int) $total->getAmount(), $total->getCurrency()->getCode(), $method->value, (string) config('payments.return_url')));

                    $paiement = (new OnlinePayment)->forceFill([
                        'id' => $id,
                        'lease_id' => $position->leaseId,
                        'party_id' => $position->partyId,
                        'created_by_user_id' => $user->id,
                        'installment_ids' => $ids,
                        'installments_hash' => $empreinte,
                        'amount' => $total,
                        'currency' => $total->getCurrency()->getCode(),
                        'method' => $method,
                        'status' => OnlinePaymentStatus::Pending,
                        'provider' => $this->passerelle->name(),
                        'provider_reference' => $session->providerReference,
                        'checkout_url' => $session->redirectUrl,
                        'client_id' => $clientId,
                    ]);
                    $paiement->save();
                    $this->audit->handle('payments.online_payment.created', $user->id, ['method' => $method->value, 'installments' => count($ids)], $paiement);

                    return ['payment' => $paiement, 'replayed' => false];
                });
            } catch (UniqueConstraintViolationException $erreur) {
                $existant = $this->existing($position, $clientId, $empreinte) ?? throw $erreur;

                return $this->replay($existant, $position, $empreinte, $method, $clientId);
            }
        });
    }

    /**
     * Une échéance ne se paie qu'une fois à la fois, par n'importe quelle fiche du bail : sans cela deux colocataires, ou une intention
     * élargie, débitent deux fois la même somme.
     *
     * @param  list<string>  $ids
     */
    private function assertNotCovered(string $leaseId, array $ids): void
    {
        $engagees = $this->couvertes->of($leaseId);

        foreach ($ids as $id) {
            if (isset($engagees[$id])) {
                throw ErrorCode::PaymentInstallmentsInProgress->problem();
            }
        }
    }

    private function existing(TenantStandingData $position, string $clientId, string $empreinte): ?OnlinePayment
    {
        return OnlinePayment::query()->where('client_id', $clientId)->first()
            ?? OnlinePayment::query()->where('lease_id', $position->leaseId)->where('party_id', $position->partyId)->where('installments_hash', $empreinte)
                ->whereIn('status', [OnlinePaymentStatus::Pending->value, OnlinePaymentStatus::Processing->value])->first();
    }

    /**
     * @return array{payment: OnlinePayment, replayed: bool}
     */
    private function replay(OnlinePayment $existant, TenantStandingData $position, string $empreinte, OnlinePaymentMethod $method, string $clientId): array
    {
        $memes = $existant->lease_id === $position->leaseId && $existant->party_id === $position->partyId && $existant->installments_hash === $empreinte && $existant->method === $method;

        if ($existant->client_id === $clientId && ! $memes) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return ['payment' => $existant, 'replayed' => true];
    }

    /**
     * @param  list<string>  $ids
     */
    private function total(TenantStandingData $position, array $ids): Money
    {
        $payables = [];

        foreach ($this->loyers->payableInstallments($position->leaseId) as $echeance) {
            if ($position->ownsDueDate($echeance->dueDate)) {
                $payables[$echeance->installmentId] = $echeance->outstanding;
            }
        }

        $total = null;

        foreach ($ids as $id) {
            if (! isset($payables[$id])) {
                throw ErrorCode::PaymentNothingDue->problem();
            }

            $total = $total === null ? $payables[$id] : $total->add($payables[$id]);
        }

        return $total ?? new Money(0, new Currency('EUR'));
    }
}
