<?php

declare(strict_types=1);

namespace App\Modules\Properties;

use App\Modules\Properties\Console\VerifyOwnershipsCommand;
use App\Modules\Properties\Models\Property;
use App\Modules\Properties\Models\PropertyContact;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\Models\UnitOwnership;
use App\Modules\Properties\Queries\ReminderTargets;
use App\Shared\Reminders\ReminderRegistry;
use App\Shared\Reminders\ReminderWindow;
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
            'property_contact' => PropertyContact::class,
        ]);

        $this->app->make(ReminderRegistry::class)->register(
            'property_missing',
            fn (ReminderWindow $fenetre): iterable => $this->app->make(ReminderTargets::class)->organizationsWithoutProperty($fenetre),
        );

        if ($this->app->runningInConsole()) {
            $this->commands([VerifyOwnershipsCommand::class]);
        }
    }
}
