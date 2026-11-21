<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\PayoutAccountRequestStatus;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\Parties\PublicApi\PartyBankAccounts;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RejectPayoutAccountRequest
{
    public function __construct(
        private PartyBankAccounts $comptes,
        private RecordAudit $audit,
    ) {}

    public function handle(string $requestId, int $lockVersion, string $motif, string $userId): PayoutAccountRequest
    {
        return DB::transaction(function () use ($requestId, $lockVersion, $motif, $userId): PayoutAccountRequest {
            $demande = PayoutAccountRequest::query()->whereKey($requestId)->lockForUpdate()->first() ?? throw ErrorCode::RequestNotFound->problem();

            if ($demande->status !== PayoutAccountRequestStatus::Pending) {
                throw ErrorCode::RequestNotActionable->problem();
            }

            if ($demande->lock_version !== $lockVersion) {
                throw ErrorCode::RequestStale->problem();
            }

            $this->comptes->discard($demande->bank_account_id);
            $demande->status = PayoutAccountRequestStatus::Rejected;
            $demande->reject_reason = $motif;
            $demande->decided_by_user_id = $userId;
            $demande->decided_at = now();
            $demande->lock_version++;
            $demande->save();
            $this->audit->handle('ownerfunds.payout_account.rejected', subject: $demande, metadata: ['mandant_party_id' => $demande->mandant_party_id]);

            return $demande;
        });
    }
}
