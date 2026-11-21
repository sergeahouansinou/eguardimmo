<?php

declare(strict_types=1);

use App\Modules\Operations\Http\Controllers\Console\ApproveApprovalController;
use App\Modules\Operations\Http\Controllers\Console\CancelApprovalController;
use App\Modules\Operations\Http\Controllers\Console\ListApprovalsController;
use App\Modules\Operations\Http\Controllers\Console\ListBackupsController;
use App\Modules\Operations\Http\Controllers\Console\RejectApprovalController;
use App\Modules\Operations\Http\Controllers\Console\RequestApprovalController;
use App\Modules\Operations\Http\Controllers\Console\ShowApprovalController;
use App\Modules\Operations\Http\Controllers\Console\ShowHealthController;
use App\Modules\Operations\Http\Controllers\Console\ShowSettingsController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'space:operator', 'operator:admin,support,compliance,billing'])->prefix('console/approvals')->group(function (): void {
    Route::middleware('throttle:console-read')->group(function (): void {
        Route::get('/', ListApprovalsController::class)->name('operations.console.approvals.index');
        Route::get('/{approval}', ShowApprovalController::class)->whereUuid('approval')->name('operations.console.approvals.show');
    });

    Route::middleware(['throttle:console-approvals', 'operator-proof'])->group(function (): void {
        Route::post('/', RequestApprovalController::class)->name('operations.console.approvals.store');
        Route::post('/{approval}/approve', ApproveApprovalController::class)->whereUuid('approval')->name('operations.console.approvals.approve');
        Route::post('/{approval}/reject', RejectApprovalController::class)->whereUuid('approval')->name('operations.console.approvals.reject');
        Route::post('/{approval}/cancel', CancelApprovalController::class)->whereUuid('approval')->name('operations.console.approvals.cancel');
    });
});

Route::middleware(['auth:sanctum', 'space:operator', 'operator:admin,support,engineering'])->prefix('console')->group(function (): void {
    Route::get('/health', ShowHealthController::class)->middleware('throttle:console-health')->name('operations.console.health');
    Route::middleware('throttle:console-read')->group(function (): void {
        Route::get('/backups', ListBackupsController::class)->name('operations.console.backups.index');
        Route::get('/settings', ShowSettingsController::class)->name('operations.console.settings');
    });
});
