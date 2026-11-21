<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Resources;

use App\Modules\Banking\Models\BankReconciliation;
use App\Modules\Banking\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property BankReconciliation $resource
 */
final class BankReconciliationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $r = $this->resource;
        $trous = $r->items['gaps'] ?? [];

        return [
            'id' => $r->id,
            'bank_account_id' => $r->bank_account_id,
            'as_of' => $r->as_of->toDateString(),
            'currency' => $r->currency,
            'status' => $r->status->value,
            'bank_balance_source' => $r->bank_balance_source,
            'bank_balance' => MoneyShape::of($r->bank_balance),
            'has_balance_proof' => $r->balance_proof_file_id !== null,
            'book_balance' => MoneyShape::of($r->book_balance),
            'unmatched_lines_total' => MoneyShape::of($r->unmatched_lines_total),
            'unmatched_entries_total' => MoneyShape::of($r->unmatched_entries_total),
            'ignored_total' => MoneyShape::of($r->ignored_total),
            'timing_difference' => MoneyShape::of($r->timing_difference),
            'unexplained_difference' => MoneyShape::of($r->unexplained_difference),
            'has_gap' => is_array($trous) && $trous !== [],
            'validatable' => $r->status->value === 'draft' && $r->unexplained_difference->isZero() && ! (is_array($trous) && $trous !== []),
            'items' => $r->items,
            'validated_by_user_id' => $r->validated_by_user_id,
            'validated_at' => $r->validated_at?->toIso8601String(),
            'supersedes_id' => $r->supersedes_id,
            'created_at' => $r->created_at?->toIso8601String(),
        ];
    }
}
