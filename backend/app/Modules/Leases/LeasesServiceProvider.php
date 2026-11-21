<?php

declare(strict_types=1);

namespace App\Modules\Leases;

use App\Modules\Leases\Console\FlagUnacknowledgedNoticesCommand;
use App\Modules\Leases\Console\VerifyLeasesCommand;
use App\Modules\Leases\Http\Middleware\PrivateResponse;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseDocument;
use App\Modules\Leases\Models\LeaseInsuranceSubmission;
use App\Modules\Leases\Models\LeaseNoticeRequest;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;

final class LeasesServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__.'/Views', 'leases');
        $this->app->make(Router::class)->aliasMiddleware('leases.private', PrivateResponse::class);

        Relation::enforceMorphMap([
            'lease' => Lease::class,
            'lease_unit' => LeaseUnit::class,
            'lease_party' => LeaseParty::class,
            'lease_term' => LeaseTerm::class,
            'lease_document' => LeaseDocument::class,
            'lease_insurance_submission' => LeaseInsuranceSubmission::class,
            'lease_notice_request' => LeaseNoticeRequest::class,
        ]);

        if ($this->app->runningInConsole()) {
            $this->commands([VerifyLeasesCommand::class, FlagUnacknowledgedNoticesCommand::class]);
        }
    }
}
