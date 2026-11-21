<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\Accounting\Data\TrustCoverageData;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use Carbon\CarbonImmutable;

/**
 * Équation de cantonnement (ADR 0031, décision 7) : bloque reversements, prélèvements et clôture, jamais un encaissement.
 */
final readonly class TrustGuard
{
    public function __construct(
        private LedgerAggregates $agregats,
        private OrganizationDirectory $organisations,
    ) {}

    public function coverage(?CarbonImmutable $asOf = null): TrustCoverageData
    {
        return $this->agregats->trustCoverage($this->organisations->currency(), $asOf);
    }

    public function assertCovered(): TrustCoverageData
    {
        $couverture = $this->coverage();

        if (! $couverture->covered) {
            throw ErrorCode::TrustFundsGap->problem();
        }

        return $couverture;
    }
}
