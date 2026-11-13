<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;

// Chaque module expose ses routes dans Http/routes.php ; toutes sont montées sous /api/v1.
Route::prefix('v1')->group(function (): void {
    foreach (glob(app_path('Modules/*/Http/routes.php')) ?: [] as $fichier) {
        require $fichier;
    }
});
