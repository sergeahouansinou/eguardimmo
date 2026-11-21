<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\PayoutAccountRequestStatus;
use App\Modules\OwnerFunds\Events\PayoutAccountChangeApproved;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\OwnerFunds\Support\AbandonedPayoutRequests;
use App\Modules\Parties\PublicApi\PartyBankAccounts;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ApprovePayoutAccountRequest
{
    public function __construct(
        private Ledger $livre,
        private PartyBankAccounts $comptes,
        private AbandonedPayoutRequests $abandons,
        private RecordAudit $audit,
    ) {}

    /**
     * L'agent ressaisit l'IBAN et le titulaire lus sur la pièce : ils se comparent à la demande sans que l'IBAN ne sorte de Parties.
     * L'activation ferme l'ancienne ligne et fixe la date de changement (carence de l'ADR 0031). Le demandeur ne valide jamais sa
     * propre demande, ni un compte qui détient lui-même un accès à ce mandant ; l'accès du demandeur est revérifié sous verrou,
     * sinon l'abandon de la demande est écrit puis la réponse est un 409.
     */
    public function handle(string $requestId, int $lockVersion, #[\SensitiveParameter] string $iban, string $holderName, string $userId): PayoutAccountRequest
    {
        $revoque = false;

        $resultat = DB::transaction(function () use ($requestId, $lockVersion, $iban, $holderName, $userId, &$revoque): PayoutAccountRequest {
            $demande = PayoutAccountRequest::query()->whereKey($requestId)->first() ?? throw ErrorCode::RequestNotFound->problem();
            $this->livre->lockParty($demande->mandant_party_id);
            $demande = PayoutAccountRequest::query()->whereKey($requestId)->lockForUpdate()->firstOrFail();

            if ($demande->status !== PayoutAccountRequestStatus::Pending) {
                throw ErrorCode::RequestNotActionable->problem();
            }

            if ($demande->requested_by_user_id === $userId || $this->comptes->holdsOwnerAccess($demande->mandant_party_id, $userId)) {
                throw ErrorCode::SelfApproval->problem();
            }

            if (! $this->comptes->isOwnerAccessLive($demande->access_id, $demande->mandant_party_id)) {
                $this->abandons->abandon($demande, 'access_revoked');
                $revoque = true;

                return $demande;
            }

            if ($demande->lock_version !== $lockVersion) {
                throw ErrorCode::RequestStale->problem();
            }

            if (! $this->comptes->matchesIban($demande->bank_account_id, $iban)) {
                throw ErrorCode::IbanMismatch->problem();
            }

            $etat = $this->comptes->state($demande->bank_account_id) ?? throw ErrorCode::RequestNotActionable->problem();

            if ($this->normaliser($etat->holderName) !== $this->normaliser($holderName)) {
                throw ErrorCode::HolderMismatch->problem();
            }

            $this->comptes->activate($demande->bank_account_id, CarbonImmutable::today());
            $demande->status = PayoutAccountRequestStatus::Approved;
            $demande->decided_by_user_id = $userId;
            $demande->decided_at = now();
            $demande->lock_version++;
            $demande->save();
            $this->audit->handle('ownerfunds.payout_account.approved', subject: $demande, metadata: ['mandant_party_id' => $demande->mandant_party_id]);
            PayoutAccountChangeApproved::dispatch($demande->organization_id, $demande->mandant_party_id, $demande->id);

            return $demande;
        });

        if ($revoque) {
            throw ErrorCode::AccessRevoked->problem();
        }

        return $resultat;
    }

    private function normaliser(string $nom): string
    {
        return mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', $nom)));
    }
}
