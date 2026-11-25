<?php

declare(strict_types=1);

namespace App\Providers;

use App\Shared\Approval\ApprovalHandlers;
use App\Shared\Audience\AudienceRegistry;
use App\Shared\Reminders\ReminderRegistry;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

final class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(CurrentOrganization::class);
        $this->app->singleton(ApprovalHandlers::class);
        $this->app->singleton(AudienceRegistry::class);
        $this->app->singleton(ReminderRegistry::class);
    }

    public function boot(): void
    {
        $developpement = $this->app->environment('local', 'testing');

        Date::use(Carbon::class);
        Model::shouldBeStrict($developpement);
        Relation::requireMorphMap();

        if (! $developpement) {
            DB::prohibitDestructiveCommands();
        }

        Password::defaults(fn (): Password => Password::min(6));
    }
}
