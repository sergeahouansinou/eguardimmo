<?php

declare(strict_types=1);

namespace App\Modules\Invoicing;

use App\Modules\Invoicing\Console\FlagOverdueInvoicesCommand;
use App\Modules\Invoicing\Http\Middleware\PrivateResponse;
use App\Modules\Invoicing\Http\Middleware\RequireAgencyOrganization;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoiceLine;
use App\Modules\Invoicing\Models\InvoicePayment;
use App\Modules\Invoicing\Models\InvoiceTax;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

final class InvoicingServiceProvider extends ServiceProvider
{
    public function boot(Router $routeur): void
    {
        Relation::enforceMorphMap([
            'invoice' => Invoice::class,
            'invoice_line' => InvoiceLine::class,
            'invoice_tax' => InvoiceTax::class,
            'invoice_payment' => InvoicePayment::class,
        ]);

        $this->loadViewsFrom(__DIR__.'/Views', 'invoicing');
        $routeur->aliasMiddleware('invoicing.agency', RequireAgencyOrganization::class);
        $routeur->aliasMiddleware('invoicing.private', PrivateResponse::class);

        RateLimiter::for('invoicing-send', function (Request $request): array {
            $organisation = $request->route('organization');
            $organisation = $organisation instanceof Model ? $organisation->getKey() : $organisation;
            $facture = $request->route('invoice');
            $organisation = is_scalar($organisation) ? (string) $organisation : '-';

            return [
                Limit::perHour($this->plafond('per_invoice_per_hour', 3))->by("invoicing-send-invoice:{$organisation}:".(is_scalar($facture) ? (string) $facture : '-')),
                Limit::perHour($this->plafond('per_organization_per_hour', 60))->by("invoicing-send-organization:{$organisation}"),
            ];
        });

        if ($this->app->runningInConsole()) {
            $this->commands([FlagOverdueInvoicesCommand::class]);
        }
    }

    private function plafond(string $cle, int $defaut): int
    {
        $valeur = config("invoicing.send.{$cle}");

        return is_int($valeur) && $valeur > 0 ? $valeur : $defaut;
    }
}
