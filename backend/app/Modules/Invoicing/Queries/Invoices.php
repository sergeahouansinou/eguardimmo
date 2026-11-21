<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Queries;

use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Invoicing\Data\InvoiceFilters;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Support\Currencies;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;
use Money\Money;

final readonly class Invoices
{
    public function __construct(private LedgerReader $livre) {}

    public function get(string $id): Invoice
    {
        $facture = Str::isUuid($id) ? Invoice::query()->with(['lines', 'taxes', 'payments'])->find($id) : null;

        return $facture ?? throw ErrorCode::InvoiceNotFound->problem();
    }

    /**
     * @return CursorPaginator<int, Invoice>
     */
    public function list(InvoiceFilters $filtres, int $parPage, CarbonImmutable $today): CursorPaginator
    {
        $annee = $filtres->year;
        $recherche = $filtres->search === null ? null : addcslashes($filtres->search, '%_\\');

        return Invoice::query()
            ->when($filtres->kind !== null, fn (Builder $q) => $q->where('kind', $filtres->kind?->value))
            ->when($filtres->status !== null, fn (Builder $q) => $q->where('status', $filtres->status?->value))
            ->when($filtres->recipientPartyId !== null, fn (Builder $q) => $q->where('recipient_party_id', (string) $filtres->recipientPartyId))
            ->when($annee !== null, fn (Builder $q) => $q->where('issued_on', '>=', sprintf('%04d-01-01', $annee))->where('issued_on', '<', sprintf('%04d-01-01', ((int) $annee) + 1)))
            ->when($recherche !== null, fn (Builder $q) => $q->where('number', 'like', "%{$recherche}%"))
            ->when($filtres->overdue, fn (Builder $q) => $q
                ->where('kind', InvoiceKind::Invoice->value)
                ->whereIn('status', array_map(fn (InvoiceStatus $s): string => $s->value, InvoiceStatus::open()))
                ->where('due_on', '<', $today->toDateString()))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $filtres->cursor === null ? null : Cursor::fromEncoded($filtres->cursor));
    }

    /**
     * Reste dû de chaque facture émise, lu au grand livre en une requête ; une pièce sans écriture est absente.
     *
     * @param  iterable<Invoice>  $factures
     * @return array<string, Money>
     */
    public function outstanding(iterable $factures): array
    {
        $parDevise = [];

        foreach ($factures as $facture) {
            if ($facture->kind === InvoiceKind::Invoice && $facture->status->isEmitted()) {
                $parDevise[$facture->currency][] = $facture->id;
            }
        }

        $restes = [];

        foreach ($parDevise as $devise => $ids) {
            $restes += $this->livre->outstandingMany(ItemType::Invoice, $ids, Currencies::of($devise));
        }

        return $restes;
    }
}
