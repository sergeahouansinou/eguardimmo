<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Maintenance\Data\OwnerInvoiceShareData;
use App\Modules\Maintenance\Enums\AllocationTarget;
use App\Modules\Maintenance\Enums\SupplierInvoiceStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InvoiceAllocation;
use App\Modules\Maintenance\Models\SupplierInvoice;
use App\Modules\Maintenance\Support\Currencies;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Money\Money;

final readonly class OwnerInvoiceShares
{
    public function __construct(private CurrentOrganization $organisation) {}

    /**
     * @return list<OwnerInvoiceShareData>
     */
    public function forProperty(string $propertyId, CarbonImmutable $from, CarbonImmutable $toExclusive): array
    {
        $this->organisation->id();

        $factures = SupplierInvoice::query()
            ->where('status', '<>', SupplierInvoiceStatus::Cancelled->value)
            ->where('invoice_on', '>=', $from->toDateString())
            ->where('invoice_on', '<', $toExclusive->toDateString())
            ->whereIn('intervention_id', Intervention::query()->where('property_id', $propertyId)->select('id'))
            ->orderBy('invoice_on')->orderBy('id')
            ->get();

        return $this->hydrate($factures);
    }

    /**
     * @return list<OwnerInvoiceShareData>
     */
    public function between(CarbonImmutable $from, CarbonImmutable $toExclusive): array
    {
        $this->organisation->id();

        $factures = SupplierInvoice::query()
            ->where('status', '<>', SupplierInvoiceStatus::Cancelled->value)
            ->where('invoice_on', '>=', $from->toDateString())
            ->where('invoice_on', '<', $toExclusive->toDateString())
            ->orderBy('invoice_on')->orderBy('id')
            ->get();

        return $this->hydrate($factures);
    }

    /**
     * @param  list<string>  $invoiceIds
     * @return list<OwnerInvoiceShareData>
     */
    public function many(array $invoiceIds): array
    {
        $this->organisation->id();

        if ($invoiceIds === []) {
            return [];
        }

        $factures = SupplierInvoice::query()
            ->where('status', '<>', SupplierInvoiceStatus::Cancelled->value)
            ->whereIn('id', array_values(array_unique($invoiceIds)))
            ->orderBy('invoice_on')->orderBy('id')
            ->get();

        return $this->hydrate($factures);
    }

    /**
     * @param  Collection<int, SupplierInvoice>  $factures
     * @return list<OwnerInvoiceShareData>
     */
    private function hydrate(Collection $factures): array
    {
        if ($factures->isEmpty()) {
            return [];
        }

        $ids = $factures->pluck('id')->all();
        $parts = [];

        foreach (InvoiceAllocation::query()
            ->whereIn('supplier_invoice_id', $ids)
            ->where('target', AllocationTarget::Owner->value)
            ->whereNull('cancelled_at')
            ->get() as $imputation) {
            $parts[$imputation->supplier_invoice_id] = ($parts[$imputation->supplier_invoice_id] ?? 0) + (int) $imputation->charged_amount->getAmount();
        }

        $interventions = Intervention::query()
            ->whereIn('id', $factures->pluck('intervention_id')->unique()->values()->all())
            ->get()
            ->keyBy('id');

        $resultat = [];

        foreach ($factures as $facture) {
            $part = $parts[$facture->id] ?? 0;
            $intervention = $interventions->get($facture->intervention_id);

            if ($part === 0 || $intervention === null) {
                continue;
            }

            $resultat[] = new OwnerInvoiceShareData(
                invoiceId: $facture->id,
                interventionId: $facture->intervention_id,
                number: $facture->number,
                invoiceOn: $facture->invoice_on->toDateString(),
                propertyId: $intervention->property_id,
                unitId: $intervention->unit_id,
                natureTermId: $intervention->nature_term_id,
                ownerShare: new Money($part, Currencies::of($facture->currency)),
            );
        }

        return $resultat;
    }
}
