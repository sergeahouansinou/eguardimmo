<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\TrustDepositStatus;
use App\Modules\OwnerFunds\Enums\TrustTransferDirection;
use App\Modules\OwnerFunds\Models\TrustDepositRequest;
use App\Modules\OwnerFunds\Support\Idempotency;
use App\Modules\OwnerFunds\Support\SecondApproval;
use App\Modules\OwnerFunds\Support\TrustTransfers;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

final readonly class ConfirmTrustDeposit
{
    public function __construct(
        private Ledger $livre,
        private TrustTransfers $virements,
        private SecondApproval $doubleControle,
        private CurrentOrganization $organisation,
        private Idempotency $idempotence,
        private RecordAudit $audit,
    ) {}

    /**
     * Confirmation de l'apport : écriture débit `TrustBank`, crédit `Bank`. Le demandeur ne confirme pas sa propre demande
     * quand l'exigence figée l'interdit.
     *
     * @return array{deposit: TrustDepositRequest, replayed: bool}
     */
    public function handle(string $depositId, string $cle, string $userId): array
    {
        $empreinte = hash('sha256', "confirm-deposit|{$depositId}");
        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($depositId, $cle, $userId): array {
            $this->livre->lockParty($this->organisation->id());
            $demande = (Str::isUuid($depositId) ? TrustDepositRequest::query()->whereKey($depositId)->lockForUpdate()->first() : null) ?? throw ErrorCode::DepositNotFound->problem();

            if ($demande->status !== TrustDepositStatus::Pending) {
                throw ErrorCode::DepositNotActionable->problem();
            }

            $solo = $this->doubleControle->check($demande->second_approver_required, $demande->approvers_count, $demande->requested_by_user_id, $userId);
            $virement = $this->virements->record(TrustTransferDirection::Deposit, (int) $demande->amount->getAmount(), $demande->executed_on->toDateString(), $demande->bank_reference, $cle, $userId);
            $demande->status = TrustDepositStatus::Confirmed;
            $demande->confirmed_by_user_id = $userId;
            $demande->confirmed_at = Carbon::now();
            $demande->confirmed_solo = $solo;
            $demande->trust_transfer_id = $virement->id;
            $demande->save();
            $this->audit->handle('ownerfunds.trust.deposit_confirmed', subject: $demande, metadata: ['solo' => $solo]);

            return ['type' => 'trust_deposit_request', 'id' => $demande->id];
        });

        return ['deposit' => TrustDepositRequest::query()->findOrFail($resultat['id']), 'replayed' => $resultat['replayed']];
    }
}
