<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\TrustTransferDirection;
use App\Modules\OwnerFunds\Models\TrustTransfer;
use App\Modules\OwnerFunds\Support\Idempotency;
use App\Modules\OwnerFunds\Support\TrustGuard;
use App\Modules\OwnerFunds\Support\TrustTransfers;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

final readonly class TransferTrustFunds
{
    public function __construct(
        private Ledger $livre,
        private TrustGuard $cantonnement,
        private TrustTransfers $virements,
        private CurrentOrganization $organisation,
        private Idempotency $idempotence,
    ) {}

    /**
     * Prélèvement des honoraires, plafonné à l'excédent de l'équation de cantonnement et refusé en cas d'écart. Le verrou
     * de l'organisation sérialise les prélèvements concurrents.
     *
     * @return array{transfer: TrustTransfer, replayed: bool}
     */
    public function handle(int $montant, string $executedOn, ?string $reference, string $cle, ?string $userId, CarbonImmutable $today): array
    {
        $empreinte = hash('sha256', (string) json_encode(['transfer', TrustTransferDirection::WithdrawFees->value, $montant, $executedOn, $reference], JSON_THROW_ON_ERROR));
        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($montant, $executedOn, $reference, $cle, $userId, $today): array {
            if (CarbonImmutable::parse($executedOn)->greaterThan($today)) {
                throw ErrorCode::ItemNotActionable->problem('La date du virement ne peut pas être dans le futur.');
            }

            $this->livre->lockParty($this->organisation->id());
            $this->guard($montant);
            $virement = $this->virements->record(TrustTransferDirection::WithdrawFees, $montant, $executedOn, $reference, $cle, $userId);

            return ['type' => 'trust_transfer', 'id' => $virement->id];
        });

        return ['transfer' => TrustTransfer::query()->findOrFail($resultat['id']), 'replayed' => $resultat['replayed']];
    }

    private function guard(int $montant): void
    {
        $couverture = $this->cantonnement->assertCovered();

        if ($montant > (int) $couverture->surplus->getAmount()) {
            throw ErrorCode::TrustWithdrawalExceedsSurplus->problem();
        }
    }
}
