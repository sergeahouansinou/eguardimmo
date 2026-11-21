<?php

declare(strict_types=1);

namespace App\Modules\Payments\Queries;

use App\Modules\Leases\Data\TenantStandingData;
use App\Modules\Payments\Data\PaymentOptionsData;
use App\Modules\Payments\Enums\PaymentAccountStatus;
use App\Modules\Payments\Gateways\PaymentGateway;
use App\Modules\Payments\Models\PaymentAccount;
use App\Modules\Rent\PublicApi\RentLedger;
use App\Shared\Tenancy\CurrentOrganization;
use Money\Money;

final readonly class TenantPaymentOptions
{
    public function __construct(
        private PaymentGateway $passerelle,
        private RentLedger $loyers,
        private CoveredInstallments $couvertes,
        private CurrentOrganization $contexte,
    ) {}

    public function of(TenantStandingData $position): PaymentOptionsData
    {
        return $this->contexte->run($position->organizationId, function () use ($position): PaymentOptionsData {
            $methodes = array_values(array_map('strval', (array) config('payments.methods')));
            $payables = array_values(array_filter($this->loyers->payableInstallments($position->leaseId), fn ($e): bool => $position->ownsDueDate($e->dueDate)));
            $engagees = $this->couvertes->of($position->leaseId);
            $echeances = array_values(array_filter($payables, fn ($e): bool => ! isset($engagees[$e->installmentId])));
            $total = array_reduce($echeances, fn (?Money $somme, $e): Money => $somme === null ? $e->outstanding : $somme->add($e->outstanding));

            if ($this->passerelle->name() === 'none') {
                return new PaymentOptionsData('provider_unavailable', $methodes, [], null);
            }

            $compte = PaymentAccount::query()->where('provider', $this->passerelle->name())->first();

            if ($compte === null || $compte->status !== PaymentAccountStatus::Ready) {
                return new PaymentOptionsData('account_not_ready', $methodes, [], null);
            }

            return new PaymentOptionsData($echeances === [] ? ($payables === [] ? 'nothing_due' : 'payment_in_progress') : null, $methodes, $echeances, $total);
        });
    }
}
