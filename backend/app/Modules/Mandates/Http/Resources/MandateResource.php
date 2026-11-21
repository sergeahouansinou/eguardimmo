<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources;

use App\Modules\Mandates\Http\Support\ApiShapes;
use App\Modules\Mandates\Http\Support\NoteAccess;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Mandates\Support\MandateView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Détail d'un mandat : la note interne et la note de résiliation sont masquées au comptable.
 *
 * @property MandateView $resource
 */
final class MandateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $vue = $this->resource;
        $mandat = $vue->mandate;
        $notes = app(NoteAccess::class)->visibleTo($request);

        return [
            ...(new MandateSummaryResource($vue))->toArray($request),
            'renewal_months' => $mandat->renewal_months,
            'notice_months' => $mandat->notice_months,
            'signed_on' => $mandat->signed_on?->toDateString(),
            'signed_file_id' => $mandat->signed_file_id,
            'termination' => $mandat->termination_reason === null ? null : [
                'notice_given_on' => $mandat->notice_given_on?->toDateString(),
                'effective_on' => ApiShapes::endDate($mandat->ends_on),
                'reason' => $mandat->termination_reason,
                'note' => $notes ? $mandat->termination_note : null,
            ],
            'note' => $notes ? $mandat->note : null,
            'custom_fields' => $mandat->custom_fields,
            'units' => array_map(fn (MandateUnit $ligne): array => ApiShapes::line($ligne, $vue->unitData), $vue->units),
            'terms_history' => array_map(fn (MandateTerm $terme): array => ApiShapes::terms($terme), $vue->terms),
        ];
    }
}
