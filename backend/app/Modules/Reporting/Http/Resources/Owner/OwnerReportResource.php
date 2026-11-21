<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Resources\Owner;

use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Models\ManagementReportLine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Compte rendu publié tel que l'agence l'a émis (instantané). Jamais l'identifiant d'une écriture, la clé d'idempotence, l'empreinte,
 * l'auteur de la publication ni l'identité complète de l'émetteur ; le locataire n'y figure que par son nom.
 *
 * @property array{report: ManagementReport, agency_name: string|null, detail: bool} $resource
 */
final class OwnerReportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $r = $this->resource['report'];
        $devise = $r->currency;
        $montant = fn (?int $valeur): ?array => $valeur === null ? null : ['amount' => $valeur, 'currency' => $devise];
        $instantane = $r->snapshot ?? [];
        $mandant = is_array($instantane['mandant'] ?? null) ? $instantane['mandant'] : [];

        $donnees = [
            'id' => $r->id,
            'number' => $r->number,
            'status' => $r->status->value,
            'agency' => ['id' => $r->organization_id, 'name' => $this->resource['agency_name']],
            'mandant' => ['name' => $mandant['name'] ?? null],
            'period' => ['kind' => $r->period_kind->value, 'start' => $r->period_start->toDateString(), 'end' => $r->period()->to->toDateString()],
            'currency' => $devise,
            'sections' => $r->content['sections'] ?? [],
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
            'published_at' => $r->published_at?->toIso8601String(),
            'first_read_at' => $r->first_read_at?->toIso8601String(),
        ];

        if (! $this->resource['detail']) {
            return $donnees;
        }

        $travaux = is_array($instantane['work_references'] ?? null) ? $instantane['work_references'] : [];

        return [
            ...$donnees,
            'options' => ['reminder_detail' => ($r->options['reminder_detail'] ?? false) === true],
            'mandates' => array_map(fn (array $m): array => array_intersect_key($m, array_flip([
                'id', 'reference', 'status', 'fee_kind', 'fee_basis_points', 'fee_flat_amount', 'fee_base', 'fee_minimum_amount', 'fee_tax_mode', 'unit_ids',
            ])), is_array($instantane['mandates'] ?? null) ? $instantane['mandates'] : []),
            'units' => array_map(fn (array $u): array => array_intersect_key($u, array_flip([
                'id', 'reference', 'property_name', 'address', 'mandate_id', 'lease_id', 'lease_reference', 'tenants',
            ])), is_array($instantane['units'] ?? null) ? $instantane['units'] : []),
            'receipts' => array_map(fn (array $q): array => array_intersect_key($q, array_flip(['number', 'lease_id', 'issued_on'])), is_array($instantane['receipts'] ?? null) ? $instantane['receipts'] : []),
            'lines' => $r->relationLoaded('lines') ? $r->lines->map(fn (ManagementReportLine $l): array => [
                'position' => $l->position,
                'kind' => $l->kind->value,
                'date' => $l->entry_date->toDateString(),
                'unit_id' => $l->unit_id,
                'lease_id' => $l->lease_id,
                'mandate_id' => $l->mandate_id,
                'label' => $l->label,
                'amount' => ['amount' => $l->amount, 'currency' => $devise],
                'direction' => $l->direction->value,
                'intervention_reference' => $l->source_id === null ? null : ($travaux[$l->source_id] ?? null),
            ])->all() : [],
        ];
    }
}
