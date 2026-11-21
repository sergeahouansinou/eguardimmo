<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Resources;

use App\Modules\Accounting\Data\TrustCoverageData;
use App\Modules\OwnerFunds\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property TrustCoverageData $resource
 */
final class TrustCoverageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $c = $this->resource;

        return [
            'trust_bank' => MoneyShape::of($c->trustBank),
            'owner_payable' => MoneyShape::of($c->ownerPayable),
            'payouts_in_transit' => MoneyShape::of($c->payoutsInTransit),
            'security_deposits' => MoneyShape::of($c->securityDeposits),
            'tenant_advances' => MoneyShape::of($c->advances),
            'required' => MoneyShape::of($c->required),
            'surplus' => MoneyShape::of($c->surplus),
            'covered' => $c->covered,
        ];
    }
}
