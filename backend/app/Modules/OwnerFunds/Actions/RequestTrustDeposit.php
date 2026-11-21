<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\TrustDepositStatus;
use App\Modules\OwnerFunds\Models\TrustDepositRequest;
use App\Modules\OwnerFunds\Support\Idempotency;
use App\Modules\OwnerFunds\Support\SecondApproval;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Money\Money;

final readonly class RequestTrustDeposit
{
    public function __construct(
        private SecondApproval $doubleControle,
        private OrganizationDirectory $organisations,
        private Idempotency $idempotence,
        private RecordAudit $audit,
    ) {}

    /**
     * Demande d'apport au compte de tiers : aucune écriture avant la confirmation par un second membre habilité. L'exigence
     * de second approbateur est figée sur la demande.
     *
     * @return array{deposit: TrustDepositRequest, replayed: bool}
     */
    public function handle(int $montant, string $executedOn, string $reference, string $cle, string $userId, CarbonImmutable $today): array
    {
        $empreinte = hash('sha256', (string) json_encode(['deposit', $montant, $executedOn, $reference], JSON_THROW_ON_ERROR));
        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($montant, $executedOn, $reference, $cle, $userId, $today): array {
            if (CarbonImmutable::parse($executedOn)->greaterThan($today)) {
                throw ErrorCode::ItemNotActionable->problem('La date du virement ne peut pas être dans le futur.');
            }

            $instantane = $this->doubleControle->snapshot();
            $devise = $this->organisations->currency();
            $demande = new TrustDepositRequest;
            $demande->forceFill([
                'status' => TrustDepositStatus::Pending,
                'amount' => new Money($montant, $devise),
                'currency' => $devise->getCode(),
                'executed_on' => Carbon::parse($executedOn),
                'bank_reference' => $reference,
                'second_approver_required' => $instantane['required'],
                'approvers_count' => $instantane['count'],
                'requested_by_user_id' => $userId,
                'idempotency_key' => $cle,
            ])->save();
            $this->audit->handle('ownerfunds.trust.deposit_requested', subject: $demande, metadata: ['second_approver_required' => $instantane['required']]);

            return ['type' => 'trust_deposit_request', 'id' => $demande->id];
        });

        return ['deposit' => TrustDepositRequest::query()->findOrFail($resultat['id']), 'replayed' => $resultat['replayed']];
    }
}
