<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources\Tenant;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\VisitStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Queries\TenantView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Vue du locataire : référence et état simplifié, jamais de montant, devis, facture, mandant, prestataire (avant visite
 * confirmée, et alors seulement le contact choisi par l'équipe), responsabilité, note interne ni champ libre de l'organisation.
 *
 * @property Intervention $resource
 */
final class TenantInterventionResource extends JsonResource
{
    public function __construct(Intervention $intervention, private readonly TenantView $vue, private readonly bool $detail = false)
    {
        parent::__construct($intervention);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $i = $this->resource;
        $visites = array_map(fn ($v): array => [
            'id' => $v->id,
            'scheduled_on' => $v->scheduled_on->toDateString(),
            'slot' => $v->slot->value,
            'presence_required' => $v->presence_required,
            'status' => $v->status->value,
            'requested_on' => $v->requested_on?->toDateString(),
            'requested_slot' => $v->requested_slot?->value,
            'contact_name' => $v->status === VisitStatus::Confirmed ? $v->contact_name : null,
            'contact_phone' => $v->status === VisitStatus::Confirmed ? $v->contact_phone : null,
        ], $this->vue->visits);

        $base = [
            'id' => $i->id,
            'reference' => $i->reference,
            'state' => $i->status->tenantState(),
            'nature' => ['key' => $this->vue->natureKey, 'label' => $this->vue->natureLabel],
            'title' => $i->title,
            'description' => $i->description,
            'room' => $i->room,
            'availability' => $i->availability,
            'reported_urgency' => $i->reported_urgency?->value,
            'place' => $this->vue->place,
            'reported_on' => $i->reported_on->toDateString(),
            'decline' => $i->decline_reason === null ? null : ['reason' => $i->decline_reason, 'note' => $i->decline_note],
            'completed_on' => $i->completed_on?->toDateString(),
            'visits' => $visites,
            'cancellable' => $i->status->value === 'reported',
        ];

        if (! $this->detail) {
            return $base;
        }

        return [
            ...$base,
            'events' => array_map(fn ($e): array => [
                'id' => $e->id,
                'kind' => $e->kind->value,
                'author' => $e->actor_kind === ActorKind::Tenant ? 'tenant' : 'team',
                'text' => $e->text,
                'created_at' => $e->created_at->toIso8601String(),
            ], $this->vue->events),
            'files' => array_map(fn ($f): array => [
                'id' => $f->id,
                'kind' => $f->kind->value,
                'uploaded_by' => $f->uploaded_by_kind === ActorKind::Tenant ? 'tenant' : 'team',
                'created_at' => $f->created_at?->toIso8601String(),
            ], $this->vue->files),
        ];
    }
}
