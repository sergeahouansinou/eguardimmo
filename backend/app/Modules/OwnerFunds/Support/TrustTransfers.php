<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Enums\TrustTransferDirection;
use App\Modules\OwnerFunds\Models\TrustTransfer;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Money\Money;

/**
 * Écrit un virement entre la banque de l'agence et le compte de tiers : écriture au grand livre, ligne en ajout seul et audit.
 * À appeler dans la transaction de l'appelant, sous le verrou de l'organisation.
 */
final readonly class TrustTransfers
{
    public function __construct(
        private Ledger $livre,
        private OwnerEntries $ecritures,
        private OrganizationDirectory $organisations,
        private RecordAudit $audit,
    ) {}

    public function record(TrustTransferDirection $sens, int $montant, string $executedOn, ?string $reference, string $cle, ?string $userId): TrustTransfer
    {
        $devise = $this->organisations->currency();
        $id = (string) Str::uuid7();
        $somme = new Money($montant, $devise);
        $ecriture = $this->livre->post($this->ecritures->transfer($id, $sens, $somme, CarbonImmutable::parse($executedOn)));
        $virement = new TrustTransfer;
        $virement->forceFill([
            'id' => $id,
            'direction' => $sens,
            'amount' => $somme,
            'currency' => $devise->getCode(),
            'executed_on' => Carbon::parse($executedOn),
            'bank_reference' => $reference,
            'ledger_entry_id' => $ecriture->id,
            'created_by_user_id' => $userId,
            'idempotency_key' => $cle,
        ])->save();
        $this->audit->handle($sens === TrustTransferDirection::WithdrawFees ? 'ownerfunds.trust.withdrawn' : 'ownerfunds.trust.deposited', subject: $virement, metadata: ['direction' => $sens->value]);

        return $virement;
    }
}
