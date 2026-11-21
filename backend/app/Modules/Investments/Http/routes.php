<?php

declare(strict_types=1);

use App\Modules\Investments\Http\Controllers\Organization\ImportLoanScheduleController;
use App\Modules\Investments\Http\Controllers\Organization\ListAcquisitionsController;
use App\Modules\Investments\Http\Controllers\Organization\ListLoansController;
use App\Modules\Investments\Http\Controllers\Organization\PrepayLoanController;
use App\Modules\Investments\Http\Controllers\Organization\ShowAcquisitionController;
use App\Modules\Investments\Http\Controllers\Organization\ShowLoanController;
use App\Modules\Investments\Http\Controllers\Organization\ShowLoanScheduleController;
use App\Modules\Investments\Http\Controllers\Organization\StoreAcquisitionController;
use App\Modules\Investments\Http\Controllers\Organization\StoreLoanAttestationController;
use App\Modules\Investments\Http\Controllers\Organization\StoreLoanController;
use App\Modules\Investments\Http\Controllers\Organization\StoreLoanFeeController;
use App\Modules\Investments\Http\Controllers\Organization\UpdateAcquisitionController;
use App\Modules\Investments\Http\Controllers\Organization\VoidLoanController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:organization', 'investments.private'])->prefix('org/{organization}/investments')->group(function (): void {
    Route::middleware(['organization:owner,admin,manager,accountant', 'investments.landlord', 'throttle:120,1,investments-lecture'])->group(function (): void {
        Route::get('/acquisitions', ListAcquisitionsController::class)->name('investments.acquisitions.index');
        Route::get('/acquisitions/{acquisition}', ShowAcquisitionController::class)->whereUuid('acquisition')->name('investments.acquisitions.show');
        Route::get('/loans', ListLoansController::class)->name('investments.loans.index');
        Route::get('/loans/{loan}', ShowLoanController::class)->whereUuid('loan')->name('investments.loans.show');
        Route::get('/loans/{loan}/schedule', ShowLoanScheduleController::class)->whereUuid('loan')->name('investments.loans.schedule');
    });

    Route::middleware(['organization:owner,admin,accountant', 'investments.landlord', 'throttle:60,1,investments-ecriture'])->group(function (): void {
        Route::post('/acquisitions', StoreAcquisitionController::class)->name('investments.acquisitions.store');
        Route::patch('/acquisitions/{acquisition}', UpdateAcquisitionController::class)->whereUuid('acquisition')->name('investments.acquisitions.update');
        Route::post('/loans', StoreLoanController::class)->name('investments.loans.store');
        Route::post('/loans/{loan}/prepayments', PrepayLoanController::class)->whereUuid('loan')->name('investments.loans.prepayments.store');
        Route::post('/loans/{loan}/fees', StoreLoanFeeController::class)->whereUuid('loan')->name('investments.loans.fees.store');
        Route::post('/loans/{loan}/attestations', StoreLoanAttestationController::class)->whereUuid('loan')->name('investments.loans.attestations.store');
        Route::post('/loans/{loan}/void', VoidLoanController::class)->whereUuid('loan')->name('investments.loans.void');
    });

    Route::middleware(['organization:owner,admin,accountant', 'investments.landlord', 'throttle:investments-import'])->group(function (): void {
        Route::post('/loans/{loan}/schedule/import', ImportLoanScheduleController::class)->whereUuid('loan')->name('investments.loans.schedule.import');
    });
});
