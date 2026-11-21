<?php

declare(strict_types=1);

namespace App\Modules\Maintenance;

use App\Modules\Maintenance\Console\ExpireApprovalsCommand;
use App\Modules\Maintenance\Console\PurgeMediaCommand;
use App\Modules\Maintenance\Console\VerifyMaintenanceCommand;
use App\Modules\Maintenance\Http\Middleware\PrivateResponse;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionEvent;
use App\Modules\Maintenance\Models\InterventionFile;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Maintenance\Models\InterventionQuoteLine;
use App\Modules\Maintenance\Models\InterventionVisit;
use App\Modules\Maintenance\Models\InvoiceAllocation;
use App\Modules\Maintenance\Models\SupplierInvoice;
use App\Modules\Maintenance\Models\SupplierInvoiceTax;
use App\Modules\Maintenance\Models\SupplierPayment;
use App\Modules\Maintenance\Models\SupplierProfile;
use App\Modules\Maintenance\Models\SupplierTrade;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;

final class MaintenanceServiceProvider extends ServiceProvider
{
    public function boot(Router $routeur): void
    {
        Relation::enforceMorphMap([
            'intervention' => Intervention::class,
            'intervention_event' => InterventionEvent::class,
            'intervention_file' => InterventionFile::class,
            'intervention_visit' => InterventionVisit::class,
            'intervention_quote' => InterventionQuote::class,
            'intervention_quote_line' => InterventionQuoteLine::class,
            'intervention_approval' => InterventionApproval::class,
            'supplier_profile' => SupplierProfile::class,
            'supplier_trade' => SupplierTrade::class,
            'supplier_invoice' => SupplierInvoice::class,
            'supplier_invoice_tax' => SupplierInvoiceTax::class,
            'invoice_allocation' => InvoiceAllocation::class,
            'supplier_payment' => SupplierPayment::class,
        ]);

        $this->loadViewsFrom(__DIR__.'/Views', 'maintenance');
        $routeur->aliasMiddleware('maintenance.private', PrivateResponse::class);

        if ($this->app->runningInConsole()) {
            $this->commands([ExpireApprovalsCommand::class, VerifyMaintenanceCommand::class, PurgeMediaCommand::class]);
        }
    }
}
