<?php

declare(strict_types=1);

namespace App\Modules\Payments\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Payments\Enums\PaymentAccountStatus;
use App\Modules\Payments\Gateways\PaymentGateway;
use App\Modules\Payments\Models\PaymentAccount;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class OnboardPaymentAccount
{
    public function __construct(
        private PaymentGateway $passerelle,
        private CurrentOrganization $contexte,
        private RecordAudit $audit,
    ) {}

    /**
     * Ouvre (ou relit) le compte connecté de l'organisation chez le PSP, qui porte le KYB ; rejouable.
     *
     * @return array{account: PaymentAccount, onboarding_url: string|null}
     */
    public function handle(User $user): array
    {
        $compteDistant = $this->passerelle->onboard($this->contexte->id());

        return DB::transaction(function () use ($user, $compteDistant): array {
            $compte = PaymentAccount::query()->where('provider', $this->passerelle->name())->lockForUpdate()->first() ?? new PaymentAccount(['provider' => $this->passerelle->name()]);
            $etaitPret = $compte->exists && $compte->status === PaymentAccountStatus::Ready;
            $compte->fill([
                'provider_account_id' => $compteDistant->accountId,
                'status' => $compteDistant->ready ? PaymentAccountStatus::Ready : PaymentAccountStatus::Pending,
                'onboarded_at' => $compteDistant->ready ? ($compte->onboarded_at ?? now()) : null,
            ])->save();

            if ($compteDistant->ready && ! $etaitPret) {
                $this->audit->handle('payments.account.onboarded', $user->id, ['provider' => $compte->provider], $compte);
            }

            return ['account' => $compte, 'onboarding_url' => $compteDistant->onboardingUrl];
        });
    }
}
