<?php

declare(strict_types=1);

use App\Modules\Leases\Http\Controllers\Organization\AcceptInsuranceSubmissionController;
use App\Modules\Leases\Http\Controllers\Organization\AcknowledgeNoticeRequestController;
use App\Modules\Leases\Http\Controllers\Organization\AddLeasePartyController;
use App\Modules\Leases\Http\Controllers\Organization\AddLeaseUnitController;
use App\Modules\Leases\Http\Controllers\Organization\ArchiveLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\CancelLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\CreateLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\DownloadInsuranceSubmissionController;
use App\Modules\Leases\Http\Controllers\Organization\DownloadNoticeProofController;
use App\Modules\Leases\Http\Controllers\Organization\DuplicateLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\EndLeasePartyController;
use App\Modules\Leases\Http\Controllers\Organization\EndLeaseUnitController;
use App\Modules\Leases\Http\Controllers\Organization\ListInsuranceSubmissionsController;
use App\Modules\Leases\Http\Controllers\Organization\ListLeaseDocumentsController;
use App\Modules\Leases\Http\Controllers\Organization\ListLeasesController;
use App\Modules\Leases\Http\Controllers\Organization\ListLeaseTermsController;
use App\Modules\Leases\Http\Controllers\Organization\ListNoticeRequestsController;
use App\Modules\Leases\Http\Controllers\Organization\ListRegimesController;
use App\Modules\Leases\Http\Controllers\Organization\ListTenanciesController;
use App\Modules\Leases\Http\Controllers\Organization\RecordNoticeController;
use App\Modules\Leases\Http\Controllers\Organization\RejectInsuranceSubmissionController;
use App\Modules\Leases\Http\Controllers\Organization\RemindLeaseInsuranceController;
use App\Modules\Leases\Http\Controllers\Organization\RenewLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\RestoreLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\ReviseLeaseTermsController;
use App\Modules\Leases\Http\Controllers\Organization\ShareLeaseDocumentController;
use App\Modules\Leases\Http\Controllers\Organization\ShowLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\ShowLeaseInsuranceController;
use App\Modules\Leases\Http\Controllers\Organization\ShowNoticeRequestController;
use App\Modules\Leases\Http\Controllers\Organization\ShowOccupancyController;
use App\Modules\Leases\Http\Controllers\Organization\SignLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\TerminateLeaseController;
use App\Modules\Leases\Http\Controllers\Organization\UnshareLeaseDocumentController;
use App\Modules\Leases\Http\Controllers\Organization\UpdateLeaseController;
use App\Modules\Leases\Http\Controllers\Owner\ListOwnerLeasesController;
use App\Modules\Leases\Http\Controllers\Owner\ShowOwnerLeaseController;
use App\Modules\Leases\Http\Controllers\Tenant\DownloadTenantInsuranceController;
use App\Modules\Leases\Http\Controllers\Tenant\DownloadTenantLeaseDocumentController;
use App\Modules\Leases\Http\Controllers\Tenant\DownloadTenantNoticeLetterController;
use App\Modules\Leases\Http\Controllers\Tenant\ListTenantLeaseDocumentsController;
use App\Modules\Leases\Http\Controllers\Tenant\ListTenantLeasesController;
use App\Modules\Leases\Http\Controllers\Tenant\ListTenantNoticeRequestsController;
use App\Modules\Leases\Http\Controllers\Tenant\ShowTenantInsuranceController;
use App\Modules\Leases\Http\Controllers\Tenant\ShowTenantLeaseController;
use App\Modules\Leases\Http\Controllers\Tenant\ShowTenantNoticeOptionsController;
use App\Modules\Leases\Http\Controllers\Tenant\ShowTenantNoticeRequestController;
use App\Modules\Leases\Http\Controllers\Tenant\SubmitTenantInsuranceController;
use App\Modules\Leases\Http\Controllers\Tenant\SubmitTenantNoticeRequestController;
use App\Modules\Leases\Http\Controllers\Tenant\WithdrawTenantInsuranceController;
use App\Modules\Leases\Http\Controllers\Tenant\WithdrawTenantNoticeRequestController;
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
        Route::get('/leases/{lease}/documents', ListLeaseDocumentsController::class)->whereUuid('lease')->name('leases.documents.index');
        Route::post('/leases/{lease}/documents', ShareLeaseDocumentController::class)->whereUuid('lease')->name('leases.documents.store');
        Route::delete('/leases/{lease}/documents/{document}', UnshareLeaseDocumentController::class)->whereUuid(['lease', 'document'])->name('leases.documents.destroy');
        Route::get('/notice-requests', ListNoticeRequestsController::class)->name('leases.notice-requests.index');
        Route::get('/notice-requests/{noticeRequest}', ShowNoticeRequestController::class)->whereUuid('noticeRequest')->name('leases.notice-requests.show');
        Route::get('/notice-requests/{noticeRequest}/proof', DownloadNoticeProofController::class)->whereUuid('noticeRequest')->middleware('throttle:30,1,notice-proof')->name('leases.notice-requests.proof');
        Route::post('/notice-requests/{noticeRequest}/acknowledge', AcknowledgeNoticeRequestController::class)->whereUuid('noticeRequest')->name('leases.notice-requests.acknowledge');
        Route::get('/insurance-submissions', ListInsuranceSubmissionsController::class)->name('leases.insurance-submissions.index');
        Route::get('/insurance-submissions/{submission}/download', DownloadInsuranceSubmissionController::class)->whereUuid('submission')->middleware('throttle:30,1,insurance-download')->name('leases.insurance-submissions.download');
        Route::post('/insurance-submissions/{submission}/accept', AcceptInsuranceSubmissionController::class)->whereUuid('submission')->name('leases.insurance-submissions.accept');
        Route::post('/insurance-submissions/{submission}/reject', RejectInsuranceSubmissionController::class)->whereUuid('submission')->name('leases.insurance-submissions.reject');
        Route::get('/leases/{lease}/insurance', ShowLeaseInsuranceController::class)->whereUuid('lease')->name('leases.insurance.show');
        Route::post('/leases/{lease}/insurance/reminder', RemindLeaseInsuranceController::class)->whereUuid('lease')->name('leases.insurance.reminder');
    });
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:tenant', 'verified', 'throttle:60,1,tenant-leases'])->prefix('tenant')->group(function (): void {
    Route::get('/leases', ListTenantLeasesController::class)->name('leases.tenant.index');
    Route::get('/leases/{lease}', ShowTenantLeaseController::class)->whereUuid('lease')->name('leases.tenant.show');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:tenant', 'verified', 'leases.private'])->prefix('tenant')->group(function (): void {
    Route::get('/leases/{lease}/documents', ListTenantLeaseDocumentsController::class)->whereUuid('lease')->middleware('throttle:60,1,tenant-lease-documents')->name('leases.tenant.documents.index');
    Route::get('/leases/{lease}/documents/{document}/download', DownloadTenantLeaseDocumentController::class)->whereUuid(['lease', 'document'])->middleware('throttle:30,1,tenant-lease-documents-download')->name('leases.tenant.documents.download');
    Route::get('/leases/{lease}/notice-options', ShowTenantNoticeOptionsController::class)->whereUuid('lease')->middleware('throttle:60,1,tenant-notice-options')->name('leases.tenant.notice-options');
    Route::post('/leases/{lease}/notice-requests', SubmitTenantNoticeRequestController::class)->whereUuid('lease')->middleware(['web-session', 'reauthenticated', 'throttle:3,1440,tenant-notice-submit'])->name('leases.tenant.notice-requests.store');
    Route::get('/notice-requests', ListTenantNoticeRequestsController::class)->middleware('throttle:60,1,tenant-notice-requests')->name('leases.tenant.notice-requests.index');
    Route::get('/notice-requests/{noticeRequest}', ShowTenantNoticeRequestController::class)->whereUuid('noticeRequest')->middleware('throttle:60,1,tenant-notice-requests')->name('leases.tenant.notice-requests.show');
    Route::get('/notice-requests/{noticeRequest}/letter', DownloadTenantNoticeLetterController::class)->whereUuid('noticeRequest')->middleware('throttle:30,1,tenant-notice-letter')->name('leases.tenant.notice-requests.letter');
    Route::delete('/notice-requests/{noticeRequest}', WithdrawTenantNoticeRequestController::class)->whereUuid('noticeRequest')->middleware(['web-session', 'throttle:10,60,tenant-notice-withdraw'])->name('leases.tenant.notice-requests.destroy');
    Route::get('/leases/{lease}/insurance', ShowTenantInsuranceController::class)->whereUuid('lease')->middleware('throttle:60,1,tenant-insurance')->name('leases.tenant.insurance.show');
    Route::post('/leases/{lease}/insurance-submissions', SubmitTenantInsuranceController::class)->whereUuid('lease')->middleware(['throttle:5,60,tenant-insurance-submit-hour', 'throttle:10,1440,tenant-insurance-submit-day'])->name('leases.tenant.insurance-submissions.store');
    Route::get('/insurance-submissions/{submission}/download', DownloadTenantInsuranceController::class)->whereUuid('submission')->middleware('throttle:30,1,tenant-insurance-download')->name('leases.tenant.insurance-submissions.download');
    Route::delete('/insurance-submissions/{submission}', WithdrawTenantInsuranceController::class)->whereUuid('submission')->middleware('throttle:10,60,tenant-insurance-withdraw')->name('leases.tenant.insurance-submissions.destroy');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'throttle:60,1,owner-reads'])->prefix('owner')->group(function (): void {
    Route::get('/leases', ListOwnerLeasesController::class)->name('leases.owner.index');
    Route::get('/leases/{lease}', ShowOwnerLeaseController::class)->whereUuid('lease')->name('leases.owner.show');
});
