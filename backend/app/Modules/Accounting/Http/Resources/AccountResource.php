<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Http\Resources;

use App\Modules\Accounting\Data\AccountSummaryData;
use App\Modules\Accounting\Support\MoneyPresenter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Money\Money;

/**
 * @property AccountSummaryData $resource
 */
final class AccountResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'code' => $this->resource->code,
            'label' => $this->resource->label,
            'role' => $this->resource->role->value,
            'normal_side' => $this->resource->role->normalSide()->value,
            'balances' => array_map(fn (Money $solde): array => MoneyPresenter::present($solde), $this->resource->balances),
        ];
    }
}
