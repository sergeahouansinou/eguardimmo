<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Resources\Tenant;

use App\Modules\Inspections\Models\InspectionRemark;
use App\Modules\Inspections\Models\InspectionRemarkFile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InspectionRemark
 */
final class TenantInspectionRemarkResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'inspection_id' => $this->inspection_id,
            'kind' => $this->kind->value,
            'body' => $this->body,
            'status' => $this->status->value,
            'answer' => $this->answer === null ? null : [
                'decision' => $this->answer->value,
                'body' => $this->answer_body,
                'answered_at' => $this->answered_at?->toIso8601String(),
            ],
            'photos' => $this->files->map(fn (InspectionRemarkFile $fichier): array => ['id' => $fichier->id, 'position' => $fichier->position])->all(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
