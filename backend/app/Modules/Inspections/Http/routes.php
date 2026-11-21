<?php

declare(strict_types=1);

use App\Modules\Inspections\Http\Controllers\Organization\AnswerInspectionRemarkController;
use App\Modules\Inspections\Http\Controllers\Organization\DownloadInspectionDocumentController;
use App\Modules\Inspections\Http\Controllers\Organization\DownloadInspectionRemarkFileController;
use App\Modules\Inspections\Http\Controllers\Organization\ListInspectionRemarksController;
use App\Modules\Inspections\Http\Controllers\Organization\ListLeaseInspectionsController;
use App\Modules\Inspections\Http\Controllers\Organization\PublishInspectionController;
use App\Modules\Inspections\Http\Controllers\Organization\RecordInspectionController;
use App\Modules\Inspections\Http\Controllers\Organization\ShowInspectionController;
use App\Modules\Inspections\Http\Controllers\Organization\UpdateInspectionController;
use App\Modules\Inspections\Http\Controllers\Tenant\CreateTenantInspectionRemarkController;
use App\Modules\Inspections\Http\Controllers\Tenant\DownloadTenantInspectionDocumentController;
use App\Modules\Inspections\Http\Controllers\Tenant\DownloadTenantInspectionFileController;
use App\Modules\Inspections\Http\Controllers\Tenant\ListTenantInspectionRemarksController;
use App\Modules\Inspections\Http\Controllers\Tenant\ListTenantInspectionsController;
use App\Modules\Inspections\Http\Controllers\Tenant\ShowTenantInspectionController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'space:organization'])->prefix('org/{organization}')->group(function (): void {
    Route::middleware(['organization:owner,admin,manager', 'inspections.private'])->group(function (): void {
        Route::middleware('throttle:120,1,inspections-lecture')->group(function (): void {
            Route::get('/leases/{lease}/inspections', ListLeaseInspectionsController::class)->whereUuid('lease')->name('inspections.index');
            Route::get('/inspections/{inspection}', ShowInspectionController::class)->whereUuid('inspection')->name('inspections.show');
            Route::get('/inspections/{inspection}/remarks', ListInspectionRemarksController::class)->whereUuid('inspection')->name('inspections.remarks.index');
        });
        Route::middleware('throttle:30,1,inspections-telechargement')->group(function (): void {
            Route::get('/inspections/{inspection}/document', DownloadInspectionDocumentController::class)->whereUuid('inspection')->name('inspections.document');
            Route::get('/inspection-remark-files/{file}', DownloadInspectionRemarkFileController::class)->whereUuid('file')->name('inspections.remark-files.show');
        });
        Route::middleware('throttle:60,1,inspections-ecriture')->group(function (): void {
            Route::post('/leases/{lease}/inspections', RecordInspectionController::class)->whereUuid('lease')->name('inspections.store');
            Route::patch('/inspections/{inspection}', UpdateInspectionController::class)->whereUuid('inspection')->name('inspections.update');
            Route::post('/inspections/{inspection}/publish', PublishInspectionController::class)->whereUuid('inspection')->name('inspections.publish');
            Route::post('/inspection-remarks/{remark}/answer', AnswerInspectionRemarkController::class)->whereUuid('remark')->name('inspections.remarks.answer');
        });
    });
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:tenant', 'verified', 'inspections.private'])->prefix('tenant')->group(function (): void {
    Route::get('/inspections', ListTenantInspectionsController::class)->middleware('throttle:60,1,tenant-inspections')->name('inspections.tenant.index');
    Route::get('/inspections/{inspection}', ShowTenantInspectionController::class)->whereUuid('inspection')->middleware('throttle:60,1,tenant-inspections')->name('inspections.tenant.show');
    Route::get('/inspections/{inspection}/document', DownloadTenantInspectionDocumentController::class)->whereUuid('inspection')->middleware('throttle:30,1,tenant-inspections-download')->name('inspections.tenant.document');
    Route::get('/inspections/{inspection}/remarks', ListTenantInspectionRemarksController::class)->whereUuid('inspection')->middleware('throttle:60,1,tenant-inspection-remarks')->name('inspections.tenant.remarks.index');
    Route::post('/inspections/{inspection}/remarks', CreateTenantInspectionRemarkController::class)->whereUuid('inspection')->middleware(['throttle:20,60,tenant-inspection-remarks-hour', 'throttle:10,1440,tenant-inspection-remarks-day'])->name('inspections.tenant.remarks.store');
    Route::get('/inspection-files/{file}', DownloadTenantInspectionFileController::class)->whereUuid('file')->middleware('throttle:30,1,tenant-inspections-download')->name('inspections.tenant.files.show');
});
