<?php

declare(strict_types=1);

use App\Modules\Accounting\Http\Controllers\Organization\ListAccountsController;
use App\Modules\Accounting\Http\Controllers\Organization\ListEntriesController;
use App\Modules\Accounting\Http\Controllers\Organization\ListPeriodsController;
use App\Modules\Accounting\Http\Controllers\Organization\ShowEntryController;
use App\Modules\Accounting\Http\Controllers\Organization\ShowLeaseStatementController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'space:organization', 'organization:owner,admin,accountant'])->prefix('org/{organization}/accounting')->group(function (): void {
    Route::get('/accounts', ListAccountsController::class)->name('accounting.accounts.index');
    Route::get('/entries', ListEntriesController::class)->name('accounting.entries.index');
    Route::get('/entries/{entry}', ShowEntryController::class)->whereUuid('entry')->name('accounting.entries.show');
    Route::get('/leases/{lease}/statement', ShowLeaseStatementController::class)->whereUuid('lease')->name('accounting.leases.statement');
});

Route::middleware(['auth:sanctum', 'space:organization', 'organization:owner,admin,manager,accountant', 'throttle:120,1,accounting-periodes'])->prefix('org/{organization}/accounting')->group(function (): void {
    Route::get('/periods', ListPeriodsController::class)->name('accounting.periods.index');
});
