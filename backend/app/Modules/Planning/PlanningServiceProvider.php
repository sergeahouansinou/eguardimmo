<?php

declare(strict_types=1);

namespace App\Modules\Planning;

use App\Modules\Planning\Console\SendRemindersCommand;
use App\Modules\Planning\Models\PlanningEvent;
use App\Modules\Planning\Models\PlanningEventAttendee;
use App\Modules\Planning\Models\PlanningTask;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

final class PlanningServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Relation::enforceMorphMap([
            'planning_event' => PlanningEvent::class,
            'planning_event_attendee' => PlanningEventAttendee::class,
            'planning_task' => PlanningTask::class,
        ]);

        if ($this->app->runningInConsole()) {
            $this->commands([SendRemindersCommand::class]);
        }
    }
}
