<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Resources;

use App\Modules\Reporting\Models\ManagementReport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property ManagementReport $resource
 */
final class ManagementReportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $r = $this->resource;
        $devise = $r->currency;
        $montant = fn (?int $valeur): ?array => $valeur === null ? null : ['amount' => $valeur, 'currency' => $devise];
        $instantane = $r->snapshot ?? [];
        $mandant = is_array($instantane['mandant'] ?? null) ? $instantane['mandant'] : [];

        $donnees = [
            'id' => $r->id,
            'number' => $r->number,
            'status' => $r->status->value,
            'mandant' => ['party_id' => $r->mandant_party_id, 'name' => $mandant['name'] ?? null],
            'period' => ['kind' => $r->period_kind->value, 'start' => $r->period_start->toDateString(), 'end' => $r->period()->to->toDateString()],
            'currency' => $devise,
            'sections' => $r->content['sections'] ?? [],
            'options' => $r->options,
            'totals' => [
                'opening_balance' => $montant($r->opening_balance),
                'collected' => $montant($r->collected_total),
                'fees' => $montant($r->fees_total),
                'works' => $montant($r->works_total),
                'payout' => $montant($r->payout_total),
                'adjustments' => $montant($r->adjustments_total),
                'closing_balance' => $montant($r->closing_balance),
            ],
            'template_version' => $r->template_version,
            'supersedes_id' => $r->supersedes_id,
            'rectification_reason' => $r->rectification_reason,
            'scheduled_for' => $r->scheduled_for?->toIso8601String(),
            'notify' => $r->notify,
            'generated_at' => $r->generated_at?->toIso8601String(),
            'published_at' => $r->published_at?->toIso8601String(),
            'first_read_at' => $r->first_read_at?->toIso8601String(),
            'lock_version' => $r->lock_version,
            'created_at' => $r->created_at?->toIso8601String(),
        ];

        if ($r->relationLoaded('lines')) {
            $donnees['lines'] = $r->lines->map(fn ($l): array => [
                'position' => $l->position,
                'kind' => $l->kind->value,
                'date' => $l->entry_date->toDateString(),
                'unit_id' => $l->unit_id,
                'lease_id' => $l->lease_id,
                'mandate_id' => $l->mandate_id,
                'label' => $l->label,
                'amount' => ['amount' => $l->amount, 'currency' => $devise],
                'direction' => $l->direction->value,
            ])->all();
            $donnees['units'] = $instantane['units'] ?? [];
            $donnees['mandates'] = $instantane['mandates'] ?? [];
        }

        return $donnees;
    }
}
