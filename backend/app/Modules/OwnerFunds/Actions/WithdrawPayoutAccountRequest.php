<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\PayoutAccountRequestStatus;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\Parties\PublicApi\PartyBankAccounts;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class WithdrawPayoutAccountRequest
{
    public function __construct(
        private PartyBankAccounts $comptes,
        private RecordAudit $audit,
    ) {}

    public function handle(string $requestId, string $userId): PayoutAccountRequest
    {
        return DB::transaction(function () use ($requestId, $userId): PayoutAccountRequest {
            $demande = PayoutAccountRequest::query()->whereKey($requestId)->lockForUpdate()->first() ?? throw ErrorCode::RequestNotFound->problem();

            if (! $demande->status->isLive()) {
                throw ErrorCode::RequestNotActionable->problem();
            }

            $this->comptes->discard($demande->bank_account_id);
            $demande->status = PayoutAccountRequestStatus::Withdrawn;
            $demande->code_hash = null;
            $demande->decided_by_user_id = $userId;
            $demande->decided_at = now();
            $demande->lock_version++;
            $demande->save();
            $this->audit->handle('ownerfunds.payout_account.withdrawn', subject: $demande, metadata: ['mandant_party_id' => $demande->mandant_party_id]);

            return $demande;
        });
    }
}
