<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Queries;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Invoicing\Data\UnpaidInvoiceData;
use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Support\Currencies;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

final readonly class UnpaidInvoices
{
    public const int MAX_PAGE = 500;

    public function __construct(
        private CurrentOrganization $organisation,
        private LedgerReader $livre,
    ) {}

    /**
     * @return list<UnpaidInvoiceData>
     */
    public function overdue(CarbonImmutable $asOf, ?string $leaseId, ?string $afterId, int $limit): array
    {
        $this->organisation->id();

        $factures = Invoice::query()
            ->where('kind', InvoiceKind::Invoice->value)
            ->whereIn('status', array_map(fn (InvoiceStatus $s): string => $s->value, InvoiceStatus::open()))
            ->whereNotNull('lease_id')
            ->where('snapshot->ledger->receivable_account', AccountRole::TenantReceivable->value)
            ->where('due_on', '<', $asOf->toDateString())
            ->when($leaseId !== null, fn ($q) => $q->where('lease_id', (string) $leaseId))
            ->when($afterId !== null && Str::isUuid($afterId), fn ($q) => $q->where('id', '>', (string) $afterId))
            ->orderBy('id')
            ->limit(max(1, min($limit, self::MAX_PAGE)))
            ->get();
        $restes = [];

        foreach ($factures->groupBy('currency') as $devise => $groupe) {
            $restes += $this->livre->outstandingMany(ItemType::Invoice, array_values(array_map(strval(...), $groupe->modelKeys())), Currencies::of((string) $devise));
        }

        $impayees = [];

        foreach ($factures as $facture) {
            $reste = $restes[$facture->id] ?? null;

            if ($reste === null || ! $reste->isPositive()) {
                continue;
            }

            $impayees[] = new UnpaidInvoiceData(
                $facture->id,
                (string) $facture->number,
                (string) $facture->lease_id,
                $facture->recipient_party_id,
                (string) $facture->issued_on?->toDateString(),
                (string) $facture->due_on?->toDateString(),
                $facture->total_gross,
                $reste,
            );
        }

        return $impayees;
    }
}
