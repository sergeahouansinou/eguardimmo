<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources;

use App\Modules\Maintenance\Data\Lookups;
use App\Modules\Maintenance\Http\Support\Shapes;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Support\Committed;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Vue de l'équipe : tout l'agrégat. Les listes n'embarquent ni chronologie, ni devis, ni factures (fiche seulement) ; elles portent les visites planifiées sous forme réduite (date, créneau, état) pour l'agenda.
 *
 * @property Intervention $resource
 */
final class InterventionResource extends JsonResource
{
    public function __construct(Intervention $intervention, private readonly Lookups $noms, private readonly bool $detail = false)
    {
        parent::__construct($intervention);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $i = $this->resource;
        $lot = $i->unit_id === null ? null : ($this->noms->units[$i->unit_id] ?? null);

        $base = [
            'id' => $i->id,
            'reference' => $i->reference,
            'origin' => $i->origin->value,
            'status' => $i->status->value,
            'priority' => $i->priority->value,
            'reported_urgency' => $i->reported_urgency?->value,
            'nature_term_id' => $i->nature_term_id,
            'title' => $i->title,
            'description' => $i->description,
            'room' => $i->room,
            'availability' => $i->availability,
            'property_id' => $i->property_id,
            'unit_id' => $i->unit_id,
            'unit' => $lot === null ? null : ['id' => $lot->id, 'reference' => $lot->reference, 'property_name' => $lot->propertyName],
            'lease_id' => $i->lease_id,
            'mandate_id' => $i->mandate_id,
            'mandant' => $this->party($i->mandant_party_id),
            'reporter' => $this->party($i->reporter_party_id),
            'supplier' => $this->party($i->supplier_party_id),
            'responsibility' => $i->responsibility->value,
            'reported_on' => $i->reported_on->toDateString(),
            'due_on' => $i->due_on?->toDateString(),
            'estimated_amount' => Shapes::moneyOrNull($i->estimated_amount),
            'ceiling_amount' => Shapes::moneyOrNull($i->ceiling_amount),
            'approval_basis' => $i->approval_basis?->value,
            'emergency_reason' => $i->emergency_reason,
            'decline_reason' => $i->decline_reason,
            'decline_note' => $i->decline_note,
            'completed_on' => $i->completed_on?->toDateString(),
            'completion_note' => $i->completion_note,
            'closed_at' => $i->closed_at?->toIso8601String(),
            'follows_intervention_id' => $i->follows_intervention_id,
            'custom_fields' => $i->custom_fields,
            'lock_version' => $i->lock_version,
            'created_at' => $i->created_at?->toIso8601String(),
        ];

        if (! $this->detail) {
            return [...$base, 'visits' => $i->visits->map(fn ($v): array => [
                'id' => $v->id, 'scheduled_on' => $v->scheduled_on->toDateString(), 'slot' => $v->slot->value, 'status' => $v->status->value,
            ])->values()->all()];
        }

        return [
            ...$base,
            'committed_amount' => ['amount' => app(Committed::class)->amount($i), 'currency' => $i->currency],
            'events' => $i->events->map(fn ($e): array => (new EventResource($e))->toArray($request))->values()->all(),
            'files' => $i->files->map(fn ($f): array => (new FileResource($f))->toArray($request))->values()->all(),
            'visits' => $i->visits->map(fn ($v): array => (new VisitResource($v))->toArray($request))->values()->all(),
            'quotes' => $i->quotes->map(fn ($q): array => (new QuoteResource($q))->toArray($request))->values()->all(),
            'approvals' => $i->approvals->map(fn ($a): array => (new ApprovalResource($a))->toArray($request))->values()->all(),
            'invoices' => $i->invoices->map(fn ($f): array => (new SupplierInvoiceResource($f))->toArray($request))->values()->all(),
        ];
    }

    /**
     * @return array{id: string, name: string|null}|null
     */
    private function party(?string $id): ?array
    {
        return $id === null ? null : ['id' => $id, 'name' => $this->noms->parties[$id] ?? null];
    }
}
