<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionEvent;
use App\Modules\Maintenance\Models\InterventionFile;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Maintenance\Models\InterventionVisit;
use App\Modules\Maintenance\Models\InvoiceAllocation;
use App\Modules\Maintenance\Models\SupplierInvoice;

/**
 * Ce que le mandant peut voir d'une intervention, déjà filtré : jamais le texte libre ni l'identité du locataire, une note interne,
 * un prestataire non désigné, un devis non soumis, une photo non partagée ni une imputation qui ne le concerne pas.
 */
final readonly class OwnerView
{
    /**
     * @param  list<InterventionVisit>  $visits
     * @param  list<InterventionEvent>  $events
     * @param  list<InterventionFile>  $files
     * @param  array<string, string>  $fileNames  nom d'affichage par fichier d'intervention
     * @param  list<InterventionQuote>  $quotes
     * @param  list<InterventionApproval>  $approvals
     * @param  list<SupplierInvoice>  $invoices
     * @param  list<InvoiceAllocation>  $allocations
     */
    public function __construct(
        public ?string $natureKey,
        public ?string $natureLabel,
        public ?string $propertyName,
        public ?string $unitReference,
        public ?string $supplierName,
        public array $visits = [],
        public array $events = [],
        public array $files = [],
        public array $fileNames = [],
        public array $quotes = [],
        public array $approvals = [],
        public array $invoices = [],
        public array $allocations = [],
    ) {}
}
