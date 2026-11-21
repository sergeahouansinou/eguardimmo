<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Enums\PayoutItemStatus;
use App\Modules\OwnerFunds\Events\TrustFundsGapDetected;
use App\Modules\OwnerFunds\Models\PayoutItem;
use App\Modules\OwnerFunds\Support\TrustGuard;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;

/**
 * Contrôle quotidien : équation de cantonnement, reversements en transit égaux aux lignes en attente, aucun compte mandant
 * débiteur. Il signale, ne corrige rien (ADR 0031, décision 7).
 */
final readonly class VerifyOwnerFunds
{
    public const string ECART = 'trust_funds_gap';

    public const string TRANSIT = 'payouts_in_transit_mismatch';

    public const string DEBITEUR = 'owner_account_debit';

    public function __construct(
        private CurrentOrganization $contexte,
        private LedgerAggregates $agregats,
        private TrustGuard $cantonnement,
        private OrganizationDirectory $organisations,
        private RecordAudit $audit,
    ) {}

    /**
     * @return list<array{organization: string, kind: string}> anomalies constatées : écart de cantonnement, reversements en transit incohérents, compte mandant débiteur
     */
    public function handle(CarbonImmutable $today): array
    {
        $anomalies = [];

        foreach ($this->agregats->organizationsWithOwnerFunds() as $organisation) {
            $this->contexte->run($organisation, function () use ($organisation, $today, &$anomalies): void {
                foreach ($this->constats() as $genre) {
                    $anomalies[] = ['organization' => $organisation, 'kind' => $genre];
                    Log::critical('Anomalie des fonds des mandants', ['organization_id' => $organisation, 'kind' => $genre]);
                    $this->audit->handle('ownerfunds.verify.anomaly', metadata: ['kind' => $genre]);

                    if ($genre === self::ECART) {
                        TrustFundsGapDetected::dispatch($organisation, $today->toDateString());
                    }
                }
            });
        }

        return $anomalies;
    }

    /**
     * @return list<string>
     */
    private function constats(): array
    {
        $constats = [];
        $couverture = $this->cantonnement->coverage();

        if (! $couverture->covered) {
            $constats[] = self::ECART;
        }

        if ((int) $couverture->payoutsInTransit->getAmount() !== (int) PayoutItem::query()->where('status', PayoutItemStatus::Pending->value)->sum('net_amount')) {
            $constats[] = self::TRANSIT;
        }

        foreach ($this->agregats->allOwnerFunds($this->organisations->currency()) as $solde) {
            if ($solde->payable->isNegative()) {
                $constats[] = self::DEBITEUR;

                break;
            }
        }

        return $constats;
    }
}
