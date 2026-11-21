<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources;

use App\Modules\Maintenance\Http\Support\Shapes;
use App\Modules\Maintenance\Models\InterventionApproval;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property InterventionApproval $resource
 */
final class ApprovalResource extends JsonResource
{
    public function __construct(InterventionApproval $demande, private readonly ?bool $replayed = null)
    {
        parent::__construct($demande);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $a = $this->resource;

        return [
            'id' => $a->id,
            'intervention_id' => $a->intervention_id,
            'quote_id' => $a->quote_id,
            'amount' => Shapes::money($a->amount),
            'ceiling_amount' => Shapes::money($a->ceiling_amount),
            'status' => $a->status->value,
            'requested_at' => $a->requested_at->toIso8601String(),
            'decide_before' => $a->decide_before->toIso8601String(),
            'decided_at' => $a->decided_at?->toIso8601String(),
            'decided_via' => $a->decided_via?->value,
            'comment' => $a->comment,
            'proof_file_id' => $a->proof_file_id,
            'lock_version' => $a->lock_version,
            'replayed' => $this->replayed,
        ];
    }
}
