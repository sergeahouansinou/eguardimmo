<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\OwnerFunds\Enums\HoldKind;
use App\Modules\OwnerFunds\Enums\HoldReason;
use App\Modules\OwnerFunds\Enums\PayoutAccountRequestStatus;
use App\Modules\OwnerFunds\Events\PayoutAccountChangeContested;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\OwnerFunds\Models\PayoutHold;
use App\Modules\Parties\PublicApi\PartyBankAccounts;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class ContestPayoutAccount
{
    public function __construct(
        private Ledger $livre,
        private PlaceHold $retenues,
        private PartyBankAccounts $comptes,
        private RecordAudit $audit,
    ) {}

    /**
     * « Ce n'est pas moi » : retenue pleine sur les reversements et abandon de la demande vivante. Rejouable : une seule retenue
     * de ce motif à la fois. L'ancien IBAN se rétablit par une nouvelle ligne de l'agence, jamais en réécrivant.
     */
    public function handle(string $mandantId, string $userId): PayoutHold
    {
        return DB::transaction(function () use ($mandantId, $userId): PayoutHold {
            $this->livre->lockParty($mandantId);

            foreach (PayoutAccountRequest::query()->where('mandant_party_id', $mandantId)->whereIn('status', [PayoutAccountRequestStatus::AwaitingCode->value, PayoutAccountRequestStatus::Pending->value])->lockForUpdate()->get() as $demande) {
                $this->comptes->discard($demande->bank_account_id);
                $demande->status = PayoutAccountRequestStatus::Rejected;
                $demande->code_hash = null;
                $demande->reject_reason = 'contested';
                $demande->decided_at = now();
                $demande->lock_version++;
                $demande->save();
            }

            $retenue = PayoutHold::query()->where('mandant_party_id', $mandantId)->where('reason', HoldReason::AccountChangeContested->value)->whereNull('released_at')->first();

            if ($retenue !== null) {
                return $retenue;
            }

            $retenue = $this->retenues->handle($mandantId, HoldKind::Full, null, HoldReason::AccountChangeContested, 'Contestation du changement de compte par le titulaire.', $userId);
            $this->audit->handle('ownerfunds.payout_account.contested', subject: $retenue, metadata: ['mandant_party_id' => $mandantId]);
            PayoutAccountChangeContested::dispatch($retenue->organization_id, $mandantId, $retenue->id);

            return $retenue;
        });
    }
}
