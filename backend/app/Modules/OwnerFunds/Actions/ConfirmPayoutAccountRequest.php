<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\PayoutAccountRequestStatus;
use App\Modules\OwnerFunds\Events\PayoutAccountChangeConfirmed;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\OwnerFunds\Support\ConfirmationCode;
use App\Modules\Parties\PublicApi\PartyBankAccounts;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class ConfirmPayoutAccountRequest
{
    public function __construct(
        private PartyBankAccounts $comptes,
        private RecordAudit $audit,
    ) {}

    /**
     * Le code se vérifie sous verrou et le compteur d'essais est validé même en cas d'échec : la réponse d'erreur part après la transaction.
     */
    public function handle(string $requestId, string $userId, #[\SensitiveParameter] string $code): PayoutAccountRequest
    {
        $valide = DB::transaction(function () use ($requestId, $userId, $code): bool {
            $demande = PayoutAccountRequest::query()->whereKey($requestId)->lockForUpdate()->first() ?? throw ErrorCode::RequestNotFound->problem();

            if ($demande->requested_by_user_id !== $userId) {
                throw ErrorCode::RequestNotFound->problem();
            }

            if ($demande->status !== PayoutAccountRequestStatus::AwaitingCode) {
                throw ErrorCode::RequestNotActionable->problem();
            }

            $perime = $demande->created_at === null || $demande->created_at->lt(now()->subMinutes(max(1, (int) config('owner_funds.payout_code_minutes'))));
            $maximum = max(1, (int) config('owner_funds.payout_code_attempts'));

            if ($perime || $demande->code_attempts >= $maximum) {
                $this->close($demande, PayoutAccountRequestStatus::Expired, null);

                return false;
            }

            if (! ConfirmationCode::matches($demande->id, $demande->code_hash, $code)) {
                $demande->code_attempts++;
                $demande->save();
                $this->audit->handle('ownerfunds.payout_account.code_failed', subject: $demande, metadata: ['attempts' => $demande->code_attempts]);

                if ($demande->code_attempts >= $maximum) {
                    $this->close($demande, PayoutAccountRequestStatus::Rejected, 'code_attempts_exceeded');
                }

                return false;
            }

            $demande->status = PayoutAccountRequestStatus::Pending;
            $demande->code_hash = null;
            $demande->lock_version++;
            $demande->save();
            $this->audit->handle('ownerfunds.payout_account.confirmed', subject: $demande, metadata: ['mandant_party_id' => $demande->mandant_party_id]);
            PayoutAccountChangeConfirmed::dispatch($demande->organization_id, $demande->mandant_party_id, $demande->id);

            return true;
        });

        if (! $valide) {
            throw ErrorCode::CodeInvalid->problem();
        }

        return PayoutAccountRequest::query()->findOrFail($requestId);
    }

    private function close(PayoutAccountRequest $demande, PayoutAccountRequestStatus $statut, ?string $motif): void
    {
        $this->comptes->discard($demande->bank_account_id);
        $demande->status = $statut;
        $demande->code_hash = null;
        $demande->reject_reason = $motif;
        $demande->decided_at = now();
        $demande->lock_version++;
        $demande->save();
        $this->audit->handle('ownerfunds.payout_account.'.($statut === PayoutAccountRequestStatus::Expired ? 'expired' : 'rejected'), subject: $demande, metadata: ['mandant_party_id' => $demande->mandant_party_id, 'reason' => $motif]);
    }
}
