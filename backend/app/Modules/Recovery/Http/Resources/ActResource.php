<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Resources;

use App\Modules\Recovery\Models\RecoveryAct;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property RecoveryAct $resource
 */
final class ActResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $a = $this->resource;

        return [
            'id' => $a->id,
            'case_id' => $a->case_id,
            'type' => $a->type->value,
            'performed_on' => $a->performed_on->toDateString(),
            'author_user_id' => $a->author_user_id,
            'reference' => $a->reference,
            'note' => $a->note,
            'details' => $a->data,
            'created_at' => $a->created_at->toIso8601String(),
        ];
    }
}
