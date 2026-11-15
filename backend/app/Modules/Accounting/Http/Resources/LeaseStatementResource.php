<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Http\Resources;

use App\Modules\Accounting\Data\LeaseStatementData;
use App\Modules\Accounting\Data\StatementLineData;
use App\Modules\Accounting\Support\MoneyPresenter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property LeaseStatementData $resource
 */
final class LeaseStatementResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'lease_id' => $this->resource->leaseId,
            'from' => $this->resource->from->format('Y-m-d'),
            'to' => $this->resource->to->format('Y-m-d'),
            'opening_balance' => MoneyPresenter::present($this->resource->opening),
            'lines' => array_map(fn (StatementLineData $ligne): array => [
                'entry_id' => $ligne->entryId,
                'reference' => $ligne->reference,
                'date' => $ligne->date->format('Y-m-d'),
                'journal' => $ligne->journal->value,
                'label' => $ligne->label,
                'debit' => MoneyPresenter::present($ligne->debit),
                'credit' => MoneyPresenter::present($ligne->credit),
                'balance' => MoneyPresenter::present($ligne->balance),
            ], $this->resource->lines),
            'closing_balance' => MoneyPresenter::present($this->resource->closing),
        ];
    }
}
