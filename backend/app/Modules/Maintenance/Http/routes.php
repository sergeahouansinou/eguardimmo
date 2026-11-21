<?php

declare(strict_types=1);

use App\Modules\Maintenance\Http\Controllers\Organization\AcceptQuoteController;
use App\Modules\Maintenance\Http\Controllers\Organization\AssignSupplierController;
use App\Modules\Maintenance\Http\Controllers\Organization\CancelAllocationController;
use App\Modules\Maintenance\Http\Controllers\Organization\CancelInterventionController;
use App\Modules\Maintenance\Http\Controllers\Organization\CancelSupplierInvoiceController;
use App\Modules\Maintenance\Http\Controllers\Organization\CancelSupplierPaymentController;
use App\Modules\Maintenance\Http\Controllers\Organization\CancelVisitController;
use App\Modules\Maintenance\Http\Controllers\Organization\ChangeSupplierStatusController;
use App\Modules\Maintenance\Http\Controllers\Organization\CloseInterventionController;
use App\Modules\Maintenance\Http\Controllers\Organization\CompleteInterventionController;
use App\Modules\Maintenance\Http\Controllers\Organization\ConfirmVisitController;
use App\Modules\Maintenance\Http\Controllers\Organization\DeclineInterventionController;
use App\Modules\Maintenance\Http\Controllers\Organization\DownloadInterventionFileController;
use App\Modules\Maintenance\Http\Controllers\Organization\EngageInterventionController;
use App\Modules\Maintenance\Http\Controllers\Organization\ListInterventionsController;
use App\Modules\Maintenance\Http\Controllers\Organization\ListQuotesController;
use App\Modules\Maintenance\Http\Controllers\Organization\ListSuppliersController;
use App\Modules\Maintenance\Http\Controllers\Organization\MarkVisitDoneController;
use App\Modules\Maintenance\Http\Controllers\Organization\MarkVisitNoShowController;
use App\Modules\Maintenance\Http\Controllers\Organization\QualifyInterventionController;
use App\Modules\Maintenance\Http\Controllers\Organization\RecordApprovalDecisionController;
use App\Modules\Maintenance\Http\Controllers\Organization\RefuseQuoteController;
use App\Modules\Maintenance\Http\Controllers\Organization\ReopenInterventionController;
use App\Modules\Maintenance\Http\Controllers\Organization\ShareFileController;
use App\Modules\Maintenance\Http\Controllers\Organization\ShowInterventionController;
use App\Modules\Maintenance\Http\Controllers\Organization\ShowSupplierController;
use App\Modules\Maintenance\Http\Controllers\Organization\ShowSupplierInvoiceController;
use App\Modules\Maintenance\Http\Controllers\Organization\StoreAllocationController;
use App\Modules\Maintenance\Http\Controllers\Organization\StoreCommentController;
use App\Modules\Maintenance\Http\Controllers\Organization\StoreInterventionController;
use App\Modules\Maintenance\Http\Controllers\Organization\StoreInterventionFileController;
use App\Modules\Maintenance\Http\Controllers\Organization\StoreQuoteController;
use App\Modules\Maintenance\Http\Controllers\Organization\StoreSupplierController;
use App\Modules\Maintenance\Http\Controllers\Organization\StoreSupplierInvoiceController;
use App\Modules\Maintenance\Http\Controllers\Organization\StoreSupplierPaymentController;
use App\Modules\Maintenance\Http\Controllers\Organization\StoreVisitController;
use App\Modules\Maintenance\Http\Controllers\Organization\SubmitQuoteController;
use App\Modules\Maintenance\Http\Controllers\Organization\UpdateInterventionController;
use App\Modules\Maintenance\Http\Controllers\Organization\UpdateQuoteController;
use App\Modules\Maintenance\Http\Controllers\Organization\UpdateSupplierController;
use App\Modules\Maintenance\Http\Controllers\Organization\UpdateVisitController;
use App\Modules\Maintenance\Http\Controllers\Organization\WithdrawApprovalController;
use App\Modules\Maintenance\Http\Controllers\Owner\DecideOwnerApprovalController;
use App\Modules\Maintenance\Http\Controllers\Owner\DownloadOwnerFileController;
use App\Modules\Maintenance\Http\Controllers\Owner\ListOwnerInterventionsController;
use App\Modules\Maintenance\Http\Controllers\Owner\ShowOwnerInterventionController;
use App\Modules\Maintenance\Http\Controllers\Tenant\CancelTenantInterventionController;
use App\Modules\Maintenance\Http\Controllers\Tenant\ConfirmTenantVisitController;
use App\Modules\Maintenance\Http\Controllers\Tenant\DownloadTenantFileController;
use App\Modules\Maintenance\Http\Controllers\Tenant\ListTenantInterventionsController;
use App\Modules\Maintenance\Http\Controllers\Tenant\ListTenantReportOptionsController;
use App\Modules\Maintenance\Http\Controllers\Tenant\RequestTenantVisitRescheduleController;
use App\Modules\Maintenance\Http\Controllers\Tenant\ShowTenantInterventionController;
use App\Modules\Maintenance\Http\Controllers\Tenant\StoreTenantCommentController;
use App\Modules\Maintenance\Http\Controllers\Tenant\StoreTenantFileController;
use App\Modules\Maintenance\Http\Controllers\Tenant\StoreTenantInterventionController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:tenant', 'verified', 'maintenance.private'])->prefix('tenant')->group(function (): void {
    Route::middleware('throttle:60,1,tenant-maintenance-lecture')->group(function (): void {
        Route::get('/interventions/options', ListTenantReportOptionsController::class)->name('maintenance.tenant.interventions.options');
        Route::get('/interventions', ListTenantInterventionsController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.tenant.interventions.index');
        Route::get('/interventions/{intervention}', ShowTenantInterventionController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.tenant.interventions.show');
        Route::get('/interventions/{intervention}/files/{file}', DownloadTenantFileController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.tenant.files.download');
    });

    Route::post('/interventions', StoreTenantInterventionController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.tenant.interventions.store')->middleware(['throttle:5,60,tenant-maintenance-heure', 'throttle:10,1440,tenant-maintenance-jour']);
    Route::post('/interventions/{intervention}/files', StoreTenantFileController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.tenant.files.store')->middleware('throttle:20,60,tenant-maintenance-fichiers');
    Route::post('/interventions/{intervention}/comments', StoreTenantCommentController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.tenant.comments.store')->middleware('throttle:20,60,tenant-maintenance-commentaires');
    Route::post('/interventions/{intervention}/cancel', CancelTenantInterventionController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.tenant.interventions.cancel')->middleware('throttle:20,1,tenant-maintenance-actions');
    Route::post('/interventions/{intervention}/visits/{visit}/confirm', ConfirmTenantVisitController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.tenant.visits.confirm')->middleware('throttle:20,1,tenant-maintenance-actions');
    Route::post('/interventions/{intervention}/visits/{visit}/reschedule-request', RequestTenantVisitRescheduleController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.tenant.visits.reschedule')->middleware('throttle:20,1,tenant-maintenance-actions');
});

Route::middleware(['auth:sanctum', 'space:organization', 'no-operator-token', 'maintenance.private'])->prefix('org/{organization}')->group(function (): void {
    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:maintenance', 'throttle:120,1,maintenance-lecture'])->group(function (): void {
        Route::get('/interventions', ListInterventionsController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.interventions.index');
        Route::get('/interventions/{intervention}', ShowInterventionController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.interventions.show');
        Route::get('/interventions/{intervention}/files/{file}', DownloadInterventionFileController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.files.download');
        Route::get('/interventions/{intervention}/invoices/{invoice}', ShowSupplierInvoiceController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.invoices.show');
        Route::get('/quotes', ListQuotesController::class)->name('maintenance.quotes.index');
        Route::get('/suppliers', ListSuppliersController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.suppliers.index');
        Route::get('/suppliers/{supplier}', ShowSupplierController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.suppliers.show');
    });

    Route::middleware(['organization:owner,admin,manager', 'entitled:maintenance', 'throttle:60,1,maintenance-ecriture'])->group(function (): void {
        Route::post('/interventions', StoreInterventionController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.interventions.store');
        Route::patch('/interventions/{intervention}', UpdateInterventionController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.interventions.update');
        Route::post('/interventions/{intervention}/qualify', QualifyInterventionController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.interventions.qualify');
        Route::post('/interventions/{intervention}/decline', DeclineInterventionController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.interventions.decline');
        Route::post('/interventions/{intervention}/cancel', CancelInterventionController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.interventions.cancel');
        Route::post('/interventions/{intervention}/assign', AssignSupplierController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.interventions.assign');
        Route::post('/interventions/{intervention}/engage', EngageInterventionController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.interventions.engage')->middleware('throttle:20,1,maintenance-engagement');
        Route::post('/interventions/{intervention}/complete', CompleteInterventionController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.interventions.complete');
        Route::post('/interventions/{intervention}/close', CloseInterventionController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.interventions.close');
        Route::post('/interventions/{intervention}/reopen', ReopenInterventionController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.interventions.reopen');
        Route::post('/interventions/{intervention}/comments', StoreCommentController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.comments.store');
        Route::post('/interventions/{intervention}/files', StoreInterventionFileController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.files.store')->middleware('throttle:30,1,maintenance-fichiers');
        Route::patch('/interventions/{intervention}/files/{file}', ShareFileController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.files.share');
        Route::post('/interventions/{intervention}/visits', StoreVisitController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.visits.store');
        Route::patch('/interventions/{intervention}/visits/{visit}', UpdateVisitController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.visits.update');
        Route::post('/interventions/{intervention}/visits/{visit}/confirm', ConfirmVisitController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.visits.confirm');
        Route::post('/interventions/{intervention}/visits/{visit}/done', MarkVisitDoneController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.visits.done');
        Route::post('/interventions/{intervention}/visits/{visit}/cancel', CancelVisitController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.visits.cancel');
        Route::post('/interventions/{intervention}/visits/{visit}/no-show', MarkVisitNoShowController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.visits.no-show');
        Route::post('/interventions/{intervention}/quotes', StoreQuoteController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.quotes.store');
        Route::patch('/interventions/{intervention}/quotes/{quote}', UpdateQuoteController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.quotes.update');
        Route::post('/interventions/{intervention}/quotes/{quote}/submit', SubmitQuoteController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.quotes.submit');
        Route::post('/interventions/{intervention}/quotes/{quote}/accept', AcceptQuoteController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.quotes.accept');
        Route::post('/interventions/{intervention}/quotes/{quote}/refuse', RefuseQuoteController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.quotes.refuse');
        Route::post('/interventions/{intervention}/approvals/{approval}/record-decision', RecordApprovalDecisionController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.approvals.record-decision');
        Route::post('/interventions/{intervention}/approvals/{approval}/withdraw', WithdrawApprovalController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.approvals.withdraw');
        Route::post('/suppliers', StoreSupplierController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.suppliers.store');
        Route::patch('/suppliers/{supplier}', UpdateSupplierController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.suppliers.update');
        Route::post('/suppliers/{supplier}/suspend', ChangeSupplierStatusController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.suppliers.suspend')->defaults('status', 'suspended');
        Route::post('/suppliers/{supplier}/activate', ChangeSupplierStatusController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.suppliers.activate')->defaults('status', 'active');
        Route::post('/suppliers/{supplier}/archive', ChangeSupplierStatusController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.suppliers.archive')->defaults('status', 'archived');
    });

    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:maintenance', 'throttle:60,1,maintenance-factures'])->group(function (): void {
        Route::post('/interventions/{intervention}/invoices', StoreSupplierInvoiceController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.invoices.store');
        Route::post('/interventions/{intervention}/invoices/{invoice}/cancel', CancelSupplierInvoiceController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.invoices.cancel');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:maintenance', 'throttle:30,1,maintenance-imputation'])->group(function (): void {
        Route::post('/interventions/{intervention}/invoices/{invoice}/allocations', StoreAllocationController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.allocations.store');
        Route::post('/interventions/{intervention}/invoices/{invoice}/payments', StoreSupplierPaymentController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.payments.store')->middleware('two-factor');
        Route::post('/allocations/{allocation}/cancel', CancelAllocationController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.allocations.cancel');
        Route::post('/supplier-payments/{payment}/cancel', CancelSupplierPaymentController::class)->whereUuid(['intervention', 'visit', 'quote', 'approval', 'invoice', 'file', 'allocation', 'payment', 'supplier'])->name('maintenance.payments.cancel')->middleware('two-factor');
    });
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'throttle:60,1,owner-reads'])->prefix('owner')->group(function (): void {
    Route::get('/interventions', ListOwnerInterventionsController::class)->name('maintenance.owner.interventions.index');
    Route::get('/interventions/{intervention}', ShowOwnerInterventionController::class)->whereUuid('intervention')->name('maintenance.owner.interventions.show');
    Route::get('/interventions/{intervention}/files/{file}', DownloadOwnerFileController::class)->whereUuid(['intervention', 'file'])->name('maintenance.owner.files.download');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'web-session', 'throttle:10,1,owner-decision', 'two-factor', 'reauthenticated:two-factor'])->prefix('owner')->group(function (): void {
    Route::post('/interventions/{intervention}/approvals/{approval}/decision', DecideOwnerApprovalController::class)->whereUuid(['intervention', 'approval'])->name('maintenance.owner.approvals.decide');
});
