<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\OwnerFunds\Enums\PayoutAccountRequestStatus;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\Parties\PublicApi\PartyBankAccounts;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Demandes dont le code est périmé ou qui n'ont eu aucune suite : elles passent `expired` et libèrent le mandant. À appeler
 * dans une transaction, organisation courante posée.
 */
final readonly class StalePayoutRequests
{
    public function __construct(
        private PartyBankAccounts $comptes,
        private RecordAudit $audit,
    ) {}

    public function expire(?string $mandantId = null): int
    {
        $codeAvant = CarbonImmutable::now()->subMinutes(max(1, (int) config('owner_funds.payout_code_minutes')));
        $demandeAvant = CarbonImmutable::now()->subDays(max(1, (int) config('owner_funds.payout_request_days')));
        $perimees = PayoutAccountRequest::query()
            ->when($mandantId !== null, fn (Builder $q) => $q->where('mandant_party_id', $mandantId))
            ->where(fn (Builder $q) => $q
                ->where(fn (Builder $a) => $a->where('status', PayoutAccountRequestStatus::AwaitingCode->value)->where('created_at', '<', $codeAvant))
                ->orWhere(fn (Builder $p) => $p->where('status', PayoutAccountRequestStatus::Pending->value)->where('created_at', '<', $demandeAvant)))
            ->lockForUpdate()->get();

        foreach ($perimees as $demande) {
            $this->comptes->discard($demande->bank_account_id);
            $demande->status = PayoutAccountRequestStatus::Expired;
            $demande->decided_at = now();
            $demande->lock_version++;
            $demande->save();
            $this->audit->handle('ownerfunds.payout_account.expired', subject: $demande, metadata: ['mandant_party_id' => $demande->mandant_party_id]);
        }

        return $perimees->count();
    }
}
