<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources\Owner;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\DecidedVia;
use App\Modules\Maintenance\Enums\InterventionOrigin;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionEvent;
use App\Modules\Maintenance\Models\InterventionFile;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Maintenance\Models\InterventionQuoteLine;
use App\Modules\Maintenance\Models\InterventionVisit;
use App\Modules\Maintenance\Models\InvoiceAllocation;
use App\Modules\Maintenance\Models\SupplierInvoice;
use App\Modules\Maintenance\Queries\OwnerView;
use App\Modules\Maintenance\Support\ApprovalDigest;
use App\Modules\Maintenance\Support\Settings;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Money\Money;

/**
 * Intervention telle que le mandant la lit. Le texte libre et l'identité du locataire ne sortent jamais : une demande du locataire
 * n'est décrite que par sa nature, et un événement qu'il a écrit n'a pas de texte. Jamais de note interne, de coordonnées du
 * prestataire ni de pièce non partagée. Le motif d'urgence (texte de l'équipe, parfois sur le locataire) et le commentaire d'une décision
 * enregistrée par l'agence ne sortent pas : seul le commentaire écrit par le mandant lui-même est servi.
 *
 * @property array{intervention: Intervention, view: OwnerView, agency_name: string|null, detail: bool} $resource
 */
final class OwnerInterventionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $i = $this->resource['intervention'];
        $v = $this->resource['view'];
        $equipe = $i->origin === InterventionOrigin::Team;

        $donnees = [
            'id' => $i->id,
            'reference' => $i->reference,
            'status' => $i->status->value,
            'priority' => $i->priority->value,
            'nature' => ['key' => $v->natureKey, 'label' => $v->natureLabel],
            'title' => $equipe ? $i->title : $v->natureLabel,
            'agency' => ['id' => $i->organization_id, 'name' => $this->resource['agency_name']],
            'mandate_id' => $i->mandate_id,
            'place' => ['property_name' => $v->propertyName, 'unit_reference' => $v->unitReference, 'common_area' => $i->unit_id === null],
            'supplier' => $v->supplierName === null ? null : ['name' => $v->supplierName],
            'responsibility' => $i->responsibility->value,
            'approval_basis' => $i->approval_basis?->value,
            'estimated_amount' => $this->money($i->estimated_amount),
            'reported_on' => $i->reported_on->toDateString(),
            'due_on' => $i->due_on?->toDateString(),
            'completed_on' => $i->completed_on?->toDateString(),
            'closed_at' => $i->closed_at?->toIso8601String(),
        ];

        if (! $this->resource['detail']) {
            return $donnees;
        }

        return [
            ...$donnees,
            'description' => $equipe ? $i->description : null,
            'emergency_reason' => null,
            'visits' => array_map(fn (InterventionVisit $s): array => ['id' => $s->id, 'scheduled_on' => $s->scheduled_on->toDateString(), 'slot' => $s->slot->value, 'status' => $s->status->value], $v->visits),
            'events' => array_map(fn (InterventionEvent $e): array => [
                'id' => $e->id,
                'kind' => $e->kind->value,
                'author' => $e->actor_kind === ActorKind::Tenant ? 'tenant' : ($e->actor_kind === ActorKind::Owner ? 'owner' : 'team'),
                'text' => $e->actor_kind === ActorKind::Tenant ? null : $e->text,
                'created_at' => $e->created_at->toIso8601String(),
            ], $v->events),
            'files' => array_map(fn (InterventionFile $f): array => [
                'id' => $f->id,
                'kind' => $f->kind->value,
                'name' => $v->fileNames[$f->id] ?? 'Document',
                'created_at' => $f->created_at?->toIso8601String(),
            ], $v->files),
            'quotes' => array_map(fn (InterventionQuote $q): array => [
                'id' => $q->id,
                'reference' => $q->reference,
                'kind' => $q->kind->value,
                'status' => $q->status->value,
                'issued_on' => $q->issued_on->toDateString(),
                'valid_until' => $q->valid_until?->toDateString(),
                'proposed_on' => $q->proposed_on?->toDateString(),
                'total_net' => $this->money($q->total_net),
                'total_tax' => $this->money($q->total_tax),
                'total_gross' => $this->money($q->total_gross),
                'lines' => array_values($q->lines->map(fn (InterventionQuoteLine $l): array => [
                    'position' => $l->position,
                    'label' => $l->label,
                    'quantity_milli' => $l->quantity_milli,
                    'unit' => $l->unit,
                    'unit_price' => ['amount' => $l->unit_price, 'currency' => $q->currency],
                    'net_amount' => ['amount' => $l->net_amount, 'currency' => $q->currency],
                    'tax_rate_pcm' => $l->tax_rate_pcm,
                ])->all()),
            ], $v->quotes),
            'approvals' => array_map(fn (InterventionApproval $a): array => [
                'id' => $a->id,
                'lock_version' => $a->lock_version,
                'quote_fingerprint' => ApprovalDigest::of($a, $this->quoteOf($a, $v)),
                'statement_version' => $a->status->isOpen() ? Settings::ownerStatementVersion() : null,
                'quote_id' => $a->quote_id,
                'status' => $a->status->value,
                'amount' => $this->money($a->amount),
                'ceiling_amount' => $this->money($a->ceiling_amount),
                'requested_at' => $a->requested_at->toIso8601String(),
                'decide_before' => $a->decide_before->toIso8601String(),
                'decided_at' => $a->decided_at?->toIso8601String(),
                'decided_via' => $a->decided_via?->value,
                'comment' => $a->decided_via === DecidedVia::OwnerSpace ? $a->comment : null,
            ], $v->approvals),
            'invoices' => array_map(fn (SupplierInvoice $f): array => [
                'id' => $f->id,
                'number' => $f->number,
                'status' => $f->status->value,
                'invoice_on' => $f->invoice_on->toDateString(),
                'due_on' => $f->due_on?->toDateString(),
                'total_net' => $this->money($f->total_net),
                'total_tax' => $this->money($f->total_tax),
                'total_gross' => $this->money($f->total_gross),
            ], $v->invoices),
            'allocations' => array_map(fn (InvoiceAllocation $a): array => [
                'id' => $a->id,
                'invoice_id' => $a->supplier_invoice_id,
                'charged_amount' => $this->money($a->charged_amount),
                'created_at' => $a->created_at?->toIso8601String(),
            ], $v->allocations),
        ];
    }

    private function quoteOf(InterventionApproval $demande, OwnerView $vue): ?InterventionQuote
    {
        foreach ($vue->quotes as $devis) {
            if ($devis->id === $demande->quote_id) {
                return $devis;
            }
        }

        return null;
    }

    /**
     * @return array{amount: int, currency: string}|null
     */
    private function money(?Money $montant): ?array
    {
        return $montant === null ? null : ['amount' => (int) $montant->getAmount(), 'currency' => $montant->getCurrency()->getCode()];
    }
}
