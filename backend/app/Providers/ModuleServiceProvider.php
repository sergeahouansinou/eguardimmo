<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

/**
 * Découvre les modules de app/Modules : leur ServiceProvider et leurs migrations.
 * Les routes sont montées dans routes/api.php, les listeners dans bootstrap/app.php.
 */
final class ModuleServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        foreach (glob(app_path('Modules/*/*ServiceProvider.php')) ?: [] as $fichier) {
            $module = basename(dirname($fichier));
            $this->app->register('App\\Modules\\'.$module.'\\'.basename($fichier, '.php'));
        }
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(glob(app_path('Modules/*/Database/Migrations'), GLOB_ONLYDIR) ?: []);
    }
}
