<?php

declare(strict_types=1);

use App\Modules\Leases\Http\Controllers\Organization\AddLeasePartyController;
use App\Modules\Leases\Http\Controllers\Organization\AddLeaseUnitController;
use App\Modules\Leases\Http\Controllers\Organization\ArchiveLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\CancelLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\CreateLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\DuplicateLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\EndLeasePartyController;
use App\Modules\Leases\Http\Controllers\Organization\EndLeaseUnitController;
use App\Modules\Leases\Http\Controllers\Organization\ListLeasesController;
use App\Modules\Leases\Http\Controllers\Organization\ListLeaseTermsController;
use App\Modules\Leases\Http\Controllers\Organization\ListRegimesController;
use App\Modules\Leases\Http\Controllers\Organization\ListTenanciesController;
use App\Modules\Leases\Http\Controllers\Organization\RecordNoticeController;
use App\Modules\Leases\Http\Controllers\Organization\RenewLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\RestoreLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\ReviseLeaseTermsController;
use App\Modules\Leases\Http\Controllers\Organization\ShowLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\ShowOccupancyController;
use App\Modules\Leases\Http\Controllers\Organization\SignLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\TerminateLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\UpdateLeaseController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'space:organization'])->prefix('org/{organization}')->group(function (): void {
    Route::middleware('organization')->group(function (): void {
        Route::get('/leases', ListLeasesController::class)->name('leases.index');
        Route::get('/leases/occupancy', ShowOccupancyController::class)->middleware('throttle:120,1,leases-lecture')->name('leases.occupancy');
        Route::get('/leases/tenancies', ListTenanciesController::class)->middleware('throttle:120,1,leases-lecture')->name('leases.tenancies');
        Route::get('/leases/regimes', ListRegimesController::class)->name('leases.regimes');
        Route::get('/leases/{lease}', ShowLeaseController::class)->whereUuid('lease')->name('leases.show');
        Route::get('/leases/{lease}/terms', ListLeaseTermsController::class)->whereUuid('lease')->name('leases.terms.index');
    });

    Route::middleware(['organization:owner,admin,manager', 'throttle:60,1'])->group(function (): void {
        Route::post('/leases', CreateLeaseController::class)->name('leases.store');
        Route::patch('/leases/{lease}', UpdateLeaseController::class)->whereUuid('lease')->name('leases.update');
        Route::post('/leases/{lease}/duplicate', DuplicateLeaseController::class)->whereUuid('lease')->name('leases.duplicate');
        Route::post('/leases/{lease}/sign', SignLeaseController::class)->whereUuid('lease')->name('leases.sign');
        Route::post('/leases/{lease}/cancel', CancelLeaseController::class)->whereUuid('lease')->name('leases.cancel');
        Route::post('/leases/{lease}/archive', ArchiveLeaseController::class)->whereUuid('lease')->name('leases.archive');
        Route::delete('/leases/{lease}/archive', RestoreLeaseController::class)->whereUuid('lease')->name('leases.restore');
        Route::post('/leases/{lease}/terms/revise', ReviseLeaseTermsController::class)->whereUuid('lease')->name('leases.terms.revise');
        Route::post('/leases/{lease}/parties', AddLeasePartyController::class)->whereUuid('lease')->name('leases.parties.store');
        Route::post('/leases/{lease}/parties/{leaseParty}/end', EndLeasePartyController::class)->whereUuid(['lease', 'leaseParty'])->name('leases.parties.end');
        Route::post('/leases/{lease}/units', AddLeaseUnitController::class)->whereUuid('lease')->name('leases.units.store');
        Route::post('/leases/{lease}/units/{leaseUnit}/end', EndLeaseUnitController::class)->whereUuid(['lease', 'leaseUnit'])->name('leases.units.end');
        Route::post('/leases/{lease}/notice', RecordNoticeController::class)->whereUuid('lease')->name('leases.notice');
        Route::post('/leases/{lease}/terminate', TerminateLeaseController::class)->whereUuid('lease')->name('leases.terminate');
        Route::post('/leases/{lease}/renew', RenewLeaseController::class)->whereUuid('lease')->name('leases.renew');
    });
});
