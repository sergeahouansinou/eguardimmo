<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Resources\Tenant;

use App\Modules\Inspections\Enums\InspectionKind;
use App\Modules\Inspections\Enums\RemarkKind;
use App\Modules\Inspections\Support\TenantInspectionView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin TenantInspectionView
 */
final class TenantInspectionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $etat = $this->inspection;

        return [
            'id' => $etat->id,
            'lease_id' => $etat->lease_id,
            'kind' => $etat->kind->value,
            'performed_on' => $etat->performed_on->toDateString(),
            'performed_by' => $etat->performed_by->value,
            'signatories' => $etat->signatories,
            'exit_matches_entry' => $etat->kind === InspectionKind::Exit ? $etat->exit_matches_entry : null,
            'open_remark_kinds' => array_map(fn (RemarkKind $kind): string => $kind->value, $this->openRemarkKinds),
            'published_at' => $etat->published_at?->toIso8601String(),
        ];
    }
}
