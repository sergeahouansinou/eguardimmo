<?php

declare(strict_types=1);

namespace App\Providers;

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

        Password::defaults(fn (): Password => $developpement
            ? Password::min(8)
            : Password::min(12)->letters()->mixedCase()->numbers()->symbols()->uncompromised());
    }
}
