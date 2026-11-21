<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Queries;

use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Mandates\Data\OwnerScopeData;
use App\Shared\Tenancy\AcrossOrganizations;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Factures d'honoraires émises au mandant d'un compte propriétaire : le destinataire est le mandant et la pièce porte un mandat,
 * jamais une facture que le mandant reçoit comme locataire. Un brouillon ou une pièce abandonnée n'existe pas pour lui (ADR 0032).
 */
final readonly class OwnerInvoices
{
    public function __construct(private CurrentOrganization $contexte) {}

    /**
     * @return CursorPaginator<int, Invoice>
     */
    public function page(OwnerScopeData $portee, int $parPage, ?string $curseur): CursorPaginator
    {
        return $this->visible($portee)->orderByDesc('id')->cursorPaginate($parPage, cursor: $curseur);
    }

    /**
     * La facture, avec ses lignes et ses taxes lues dans le contexte de son organisation.
     */
    public function find(OwnerScopeData $portee, string $id, bool $avecLignes = false): ?Invoice
    {
        $facture = Str::isUuid($id) ? $this->visible($portee)->whereKey($id)->first() : null;

        if ($facture !== null && $avecLignes) {
            $this->contexte->run($facture->organization_id, fn () => $facture->load(['lines', 'taxes']));
        }

        return $facture;
    }

    /**
     * @return Builder<Invoice>
     */
    private function visible(OwnerScopeData $portee): Builder
    {
        return $portee->restrictToMandants(AcrossOrganizations::query(Invoice::class), 'organization_id', 'recipient_party_id')
            ->whereNotNull('mandate_id')
            ->whereIn('status', array_map(fn (InvoiceStatus $s): string => $s->value, InvoiceStatus::emitted()))
            ->whereNotNull('number');
    }
}
