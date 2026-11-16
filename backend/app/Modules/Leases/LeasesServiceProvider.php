<?php

declare(strict_types=1);

namespace App\Modules\Leases;

use App\Modules\Leases\Console\VerifyLeasesCommand;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

final class LeasesServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Relation::enforceMorphMap([
            'lease' => Lease::class,
            'lease_unit' => LeaseUnit::class,
            'lease_party' => LeaseParty::class,
            'lease_term' => LeaseTerm::class,
        ]);

        if ($this->app->runningInConsole()) {
            $this->commands([VerifyLeasesCommand::class]);
        }
    }
}
