<?php

declare(strict_types=1);

namespace App\Modules\Mandates;

use App\Modules\Mandates\Console\ExpireMandatesCommand;
use App\Modules\Mandates\Http\Middleware\RequireAgencyOrganization;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateDocument;
use App\Modules\Mandates\Models\MandateEndRequest;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Models\MandateTermDefault;
use App\Modules\Mandates\Models\MandateUnit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;

final class MandatesServiceProvider extends ServiceProvider
{
    public function boot(Router $routeur): void
    {
        Relation::enforceMorphMap([
            'mandate' => Mandate::class,
            'mandate_document' => MandateDocument::class,
            'mandate_end_request' => MandateEndRequest::class,
            'mandate_unit' => MandateUnit::class,
            'mandate_term' => MandateTerm::class,
            'mandate_term_defaults' => MandateTermDefault::class,
        ]);

        $routeur->aliasMiddleware('mandates.agency', RequireAgencyOrganization::class);

        if ($this->app->runningInConsole()) {
            $this->commands([ExpireMandatesCommand::class]);
        }
    }
}
