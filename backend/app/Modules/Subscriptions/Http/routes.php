<?php

declare(strict_types=1);

use App\Modules\Subscriptions\Http\Controllers\Console\CreatePlanVersionController;
use App\Modules\Subscriptions\Http\Controllers\Console\ListPlansController;
use App\Modules\Subscriptions\Http\Controllers\Console\ListSubscriptionsController;
use App\Modules\Subscriptions\Http\Controllers\Console\ShowOrganizationEntitlementsController;
use App\Modules\Subscriptions\Http\Controllers\Console\ShowPlanController;
use App\Modules\Subscriptions\Http\Controllers\Console\UpdatePlanVersionController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'space:operator'])->prefix('console')->group(function (): void {
    Route::middleware(['operator:admin,billing', 'throttle:console-read'])->group(function (): void {
        Route::get('/plans', ListPlansController::class)->name('subscriptions.console.plans.index');
        Route::get('/plans/{plan}', ShowPlanController::class)->where('plan', '[A-Za-z0-9_-]{1,64}')->name('subscriptions.console.plans.show');
        Route::get('/subscriptions', ListSubscriptionsController::class)->name('subscriptions.console.subscriptions.index');
    });
    Route::get('/organizations/{organization}/entitlements', ShowOrganizationEntitlementsController::class)->whereUuid('organization')
        ->middleware(['operator:admin,support,compliance,billing', 'throttle:console-read'])->name('subscriptions.console.entitlements.show');
    Route::middleware(['operator:billing', 'throttle:console-write', 'operator-proof'])->group(function (): void {
        Route::post('/plans/{plan}/versions', CreatePlanVersionController::class)->where('plan', '[A-Za-z0-9_-]{1,64}')->name('subscriptions.console.versions.store');
        Route::patch('/plan-versions/{version}', UpdatePlanVersionController::class)->whereUuid('version')->name('subscriptions.console.versions.update');
    });
});
