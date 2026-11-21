<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Resources;

use App\Modules\Banking\Models\BankStatement;
use App\Modules\Banking\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property BankStatement $resource
 */
final class BankStatementResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $r = $this->resource;

        return [
            'id' => $r->id,
            'bank_account_id' => $r->bank_account_id,
            'source' => $r->source->value,
            'format_version' => $r->format_version,
            'statement_ref' => $r->statement_ref,
            'sequence' => $r->sequence,
            'period_from' => $r->period_from->toDateString(),
            'period_to' => $r->period_to->toDateString(),
            'opening_balance' => $r->opening_balance === null ? null : MoneyShape::of($r->opening_balance),
            'closing_balance' => $r->closing_balance === null ? null : MoneyShape::of($r->closing_balance),
            'currency' => $r->currency,
            'lines_total' => $r->lines_total,
            'lines_imported' => $r->lines_imported,
            'lines_duplicated' => $r->lines_duplicated,
            'lines_rejected' => $r->lines_rejected,
            'is_copy' => $r->is_copy,
            'imported_by_user_id' => $r->imported_by_user_id,
            'voided_at' => $r->voided_at?->toIso8601String(),
            'void_reason' => $r->void_reason,
            'has_file' => $r->stored_file_id !== null,
            'created_at' => $r->created_at?->toIso8601String(),
        ];
    }
}
