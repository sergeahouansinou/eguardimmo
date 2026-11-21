<?php

declare(strict_types=1);

namespace App\Modules\Tax;

use App\Modules\Tax\Console\VerifyCommand;
use App\Modules\Tax\Http\Middleware\PrivateResponse;
use App\Modules\Tax\Http\Middleware\RequireAgencyOrganization;
use App\Modules\Tax\Http\Middleware\RequireLandlordOrganization;
use App\Modules\Tax\Http\Middleware\RequireTwoFactorInAgency;
use App\Modules\Tax\Models\TaxSummary;
use App\Modules\Tax\Models\TaxSummaryLine;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;

final class TaxServiceProvider extends ServiceProvider
{
    public function boot(Router $routeur): void
    {
        $routeur->aliasMiddleware('tax.private', PrivateResponse::class);
        $routeur->aliasMiddleware('tax.landlord', RequireLandlordOrganization::class);
        $routeur->aliasMiddleware('tax.agency', RequireAgencyOrganization::class);
        $routeur->aliasMiddleware('tax.two-factor-agency', RequireTwoFactorInAgency::class);

        if ($this->app->runningInConsole()) {
            $this->commands([VerifyCommand::class]);
        }

        Relation::enforceMorphMap([
            'tax_summary' => TaxSummary::class,
            'tax_summary_line' => TaxSummaryLine::class,
        ]);

        $this->loadViewsFrom(__DIR__.'/Views', 'tax');
    }
}
