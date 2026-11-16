<?php

declare(strict_types=1);

use App\Modules\Properties\Http\Controllers\Organization\AddOwnershipController;
use App\Modules\Properties\Http\Controllers\Organization\ArchivePropertyController;
use App\Modules\Properties\Http\Controllers\Organization\ArchiveUnitController;
use App\Modules\Properties\Http\Controllers\Organization\CreatePropertyController;
use App\Modules\Properties\Http\Controllers\Organization\CreateUnitController;
use App\Modules\Properties\Http\Controllers\Organization\EndOwnershipController;
use App\Modules\Properties\Http\Controllers\Organization\ListOwnershipsController;
use App\Modules\Properties\Http\Controllers\Organization\ListPropertiesController;
use App\Modules\Properties\Http\Controllers\Organization\ListUnitsController;
use App\Modules\Properties\Http\Controllers\Organization\RestorePropertyController;
use App\Modules\Properties\Http\Controllers\Organization\RestoreUnitController;
use App\Modules\Properties\Http\Controllers\Organization\ShowPropertyController;
use App\Modules\Properties\Http\Controllers\Organization\ShowUnitAnnexesController;
use App\Modules\Properties\Http\Controllers\Organization\ShowUnitController;
use App\Modules\Properties\Http\Controllers\Organization\UpdatePropertyController;
use App\Modules\Properties\Http\Controllers\Organization\UpdateUnitController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'space:organization'])->prefix('org/{organization}')->group(function (): void {
    Route::middleware('organization')->group(function (): void {
        Route::get('/properties', ListPropertiesController::class)->name('properties.index');
        Route::get('/properties/{property}', ShowPropertyController::class)->whereUuid('property')->name('properties.show');

        Route::get('/units', ListUnitsController::class)->name('properties.units.index');
        Route::get('/units/{unit}', ShowUnitController::class)->whereUuid('unit')->name('properties.units.show');
        Route::get('/units/{unit}/annexes', ShowUnitAnnexesController::class)->whereUuid('unit')->name('properties.units.annexes');
        Route::get('/units/{unit}/ownerships', ListOwnershipsController::class)->whereUuid('unit')->name('properties.units.ownerships.index');
    });

    Route::middleware(['organization:owner,admin,manager', 'throttle:60,1'])->group(function (): void {
        Route::post('/properties', CreatePropertyController::class)->name('properties.store');
        Route::patch('/properties/{property}', UpdatePropertyController::class)->whereUuid('property')->name('properties.update');
        Route::post('/properties/{property}/archive', ArchivePropertyController::class)->whereUuid('property')->name('properties.archive');
        Route::delete('/properties/{property}/archive', RestorePropertyController::class)->whereUuid('property')->name('properties.restore');

        Route::post('/units', CreateUnitController::class)->name('properties.units.store');
        Route::patch('/units/{unit}', UpdateUnitController::class)->whereUuid('unit')->name('properties.units.update');
        Route::post('/units/{unit}/archive', ArchiveUnitController::class)->whereUuid('unit')->name('properties.units.archive');
        Route::delete('/units/{unit}/archive', RestoreUnitController::class)->whereUuid('unit')->name('properties.units.restore');

        Route::post('/units/{unit}/ownerships', AddOwnershipController::class)->whereUuid('unit')->name('properties.units.ownerships.store');
        Route::post('/units/{unit}/ownerships/{ownership}/end', EndOwnershipController::class)->whereUuid(['unit', 'ownership'])->name('properties.units.ownerships.end');
    });
});
