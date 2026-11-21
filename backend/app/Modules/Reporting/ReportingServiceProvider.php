<?php

declare(strict_types=1);

namespace App\Modules\Reporting;

use App\Modules\Reporting\Console\FlagDueCommand;
use App\Modules\Reporting\Console\PublishScheduledCommand;
use App\Modules\Reporting\Console\VerifyCommand;
use App\Modules\Reporting\Http\Middleware\PrivateResponse;
use App\Modules\Reporting\Http\Middleware\RequireAgencyOrganization;
use App\Modules\Reporting\Http\Middleware\RequireLandlordOrganization;
use App\Modules\Reporting\Models\ForecastAssumption;
use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Models\ManagementReportLine;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;

final class ReportingServiceProvider extends ServiceProvider
{
    public function boot(Router $routeur): void
    {
        $routeur->aliasMiddleware('reporting.agency', RequireAgencyOrganization::class);
        $routeur->aliasMiddleware('reporting.landlord', RequireLandlordOrganization::class);
        $routeur->aliasMiddleware('reporting.private', PrivateResponse::class);

        if ($this->app->runningInConsole()) {
            $this->commands([FlagDueCommand::class, PublishScheduledCommand::class, VerifyCommand::class]);
        }

        Relation::enforceMorphMap([
            'management_report' => ManagementReport::class,
            'management_report_line' => ManagementReportLine::class,
            'forecast_assumption' => ForecastAssumption::class,
        ]);

        $this->loadViewsFrom(__DIR__.'/Views', 'reporting');
    }
}
