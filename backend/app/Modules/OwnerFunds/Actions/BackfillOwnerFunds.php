<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Jurisdictions\OwnerFundsJurisdictions;
use App\Modules\Rent\Data\OwnerBackfillReportData;
use App\Modules\Rent\PublicApi\OwnerBackfill;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Rattrapage d'une organisation (ADR 0031, décision 8) : à blanc par défaut ; appliqué, il reclasse les échéances puis
 * pose la date d'activation. Rejouable : un second passage rattrape ce qui a été posté entre-temps.
 */
final readonly class BackfillOwnerFunds
{
    public function __construct(
        private CurrentOrganization $contexte,
        private OrganizationDirectory $organisations,
        private OwnerFundsJurisdictions $juridictions,
        private OwnerBackfill $rattrapage,
        private Ledger $livre,
    ) {}

    public function handle(string $organizationId, bool $apply, CarbonImmutable $today): OwnerBackfillReportData
    {
        return $this->contexte->run($organizationId, function () use ($apply, $today): OwnerBackfillReportData {
            $this->juridictions->for($this->organisations->country());

            if (! $apply) {
                return $this->rattrapage->plan();
            }

            return DB::transaction(function () use ($today): OwnerBackfillReportData {
                $rapport = $this->rattrapage->apply();
                $this->livre->activateOwnerFunds($today);

                return $rapport;
            });
        });
    }
}
