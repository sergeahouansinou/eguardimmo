<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Actions;

use App\Modules\OwnerFunds\Queries\PayoutAccountRequests;
use App\Modules\OwnerFunds\Support\StalePayoutRequests;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ExpirePayoutAccountRequests
{
    public function __construct(
        private PayoutAccountRequests $demandes,
        private StalePayoutRequests $perimees,
        private CurrentOrganization $contexte,
    ) {}

    public function handle(): int
    {
        $total = 0;
        $codeAvant = CarbonImmutable::now()->subMinutes(max(1, (int) config('owner_funds.payout_code_minutes')));
        $demandeAvant = CarbonImmutable::now()->subDays(max(1, (int) config('owner_funds.payout_request_days')));

        foreach ($this->demandes->organizationsDue($codeAvant, $demandeAvant) as $organisation) {
            $this->contexte->run($organisation, function () use (&$total): void {
                $total += DB::transaction(fn (): int => $this->perimees->expire());
            });
        }

        return $total;
    }
}
