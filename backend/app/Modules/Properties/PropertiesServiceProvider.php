<?php

declare(strict_types=1);

namespace App\Modules\Properties;

use App\Modules\Properties\Console\VerifyOwnershipsCommand;
use App\Modules\Properties\Models\Property;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\Models\UnitOwnership;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

final class PropertiesServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Relation::enforceMorphMap([
            'property' => Property::class,
            'unit' => Unit::class,
            'unit_ownership' => UnitOwnership::class,
        ]);

        if ($this->app->runningInConsole()) {
            $this->commands([VerifyOwnershipsCommand::class]);
        }
    }
}
