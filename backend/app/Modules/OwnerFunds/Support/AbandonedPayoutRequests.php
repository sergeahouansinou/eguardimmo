<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\OwnerFunds\Enums\PayoutAccountRequestStatus;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\Parties\PublicApi\PartyBankAccounts;
use App\Shared\Audit\RecordAudit;

/**
 * Abandon d'une demande de compte de paiement dont l'accès du demandeur n'est plus vivant : le compte en attente est rejeté.
 * À appeler dans la transaction de l'appelant, demande verrouillée.
 */
final readonly class AbandonedPayoutRequests
{
    public function __construct(
        private PartyBankAccounts $comptes,
        private RecordAudit $audit,
    ) {}

    public function abandon(PayoutAccountRequest $demande, string $motif): void
    {
        $this->comptes->discard($demande->bank_account_id);
        $demande->status = PayoutAccountRequestStatus::Withdrawn;
        $demande->code_hash = null;
        $demande->reject_reason = $motif;
        $demande->decided_at = now();
        $demande->lock_version++;
        $demande->save();
        $this->audit->handle('ownerfunds.payout_account.withdrawn', subject: $demande, metadata: ['mandant_party_id' => $demande->mandant_party_id, 'reason' => $motif]);
    }
}
