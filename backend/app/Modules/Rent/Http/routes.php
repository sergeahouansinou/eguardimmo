<?php

declare(strict_types=1);

use App\Modules\Rent\Http\Controllers\Organization\CancelInstallmentController;
use App\Modules\Rent\Http\Controllers\Organization\CancelPaymentController;
use App\Modules\Rent\Http\Controllers\Organization\DownloadNoticeController;
use App\Modules\Rent\Http\Controllers\Organization\DownloadReceiptController;
use App\Modules\Rent\Http\Controllers\Organization\GenerateLeaseInstallmentsController;
use App\Modules\Rent\Http\Controllers\Organization\IssueDueNoticesController;
use App\Modules\Rent\Http\Controllers\Organization\IssueInstallmentNoticeController;
use App\Modules\Rent\Http\Controllers\Organization\IssueInstallmentReceiptController;
use App\Modules\Rent\Http\Controllers\Organization\IssuePendingReceiptsController;
use App\Modules\Rent\Http\Controllers\Organization\ListInstallmentsController;
use App\Modules\Rent\Http\Controllers\Organization\ListPaymentsController;
use App\Modules\Rent\Http\Controllers\Organization\ListReceiptsController;
use App\Modules\Rent\Http\Controllers\Organization\RecordPaymentController;
use App\Modules\Rent\Http\Controllers\Organization\RefundAdvanceController;
use App\Modules\Rent\Http\Controllers\Organization\ShowInstallmentController;
use App\Modules\Rent\Http\Controllers\Organization\ShowLeaseBalanceController;
use App\Modules\Rent\Http\Controllers\Organization\ShowPaymentController;
use App\Modules\Rent\Http\Controllers\Organization\ShowReceiptController;
use App\Modules\Rent\Http\Controllers\Tenant\DownloadTenantNoticeController;
use App\Modules\Rent\Http\Controllers\Tenant\DownloadTenantReceiptController;
use App\Modules\Rent\Http\Controllers\Tenant\ListTenantInstallmentsController;
use App\Modules\Rent\Http\Controllers\Tenant\ListTenantPaymentsController;
use App\Modules\Rent\Http\Controllers\Tenant\ListTenantReceiptsController;
use App\Modules\Rent\Http\Controllers\Tenant\ShowTenantInstallmentController;
use App\Modules\Rent\Http\Controllers\Tenant\ShowTenantPaymentController;
use App\Modules\Rent\Http\Controllers\Tenant\ShowTenantReceiptController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'space:organization'])->prefix('org/{organization}/rent')->group(function (): void {
    Route::middleware(['organization', 'entitled:rent', 'throttle:120,1,rent-lecture'])->group(function (): void {
        Route::get('/installments', ListInstallmentsController::class)->name('rent.installments.index');
        Route::get('/installments/{installment}', ShowInstallmentController::class)->whereUuid('installment')->name('rent.installments.show');
        Route::get('/installments/{installment}/notice/download', DownloadNoticeController::class)->whereUuid('installment')->name('rent.installments.notice.download');
        Route::get('/leases/{lease}/balance', ShowLeaseBalanceController::class)->whereUuid('lease')->name('rent.leases.balance');
        Route::get('/payments', ListPaymentsController::class)->name('rent.payments.index');
        Route::get('/payments/{payment}', ShowPaymentController::class)->whereUuid('payment')->name('rent.payments.show');
        Route::get('/receipts', ListReceiptsController::class)->name('rent.receipts.index');
        Route::get('/receipts/{receipt}', ShowReceiptController::class)->whereUuid('receipt')->name('rent.receipts.show');
        Route::get('/receipts/{receipt}/download', DownloadReceiptController::class)->whereUuid('receipt')->name('rent.receipts.download');
    });

    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:rent', 'throttle:60,1'])->group(function (): void {
        Route::post('/payments', RecordPaymentController::class)->name('rent.payments.store');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:rent', 'two-factor', 'throttle:20,1,rent-remboursement'])->group(function (): void {
        Route::post('/leases/{lease}/refunds', RefundAdvanceController::class)->whereUuid('lease')->name('rent.leases.refunds.store');
    });

    Route::middleware(['organization:owner,admin,manager', 'entitled:rent', 'throttle:60,1'])->group(function (): void {
        Route::post('/payments/{payment}/cancel', CancelPaymentController::class)->whereUuid('payment')->name('rent.payments.cancel');
        Route::post('/leases/{lease}/installments/generate', GenerateLeaseInstallmentsController::class)->whereUuid('lease')->name('rent.leases.installments.generate');
        Route::post('/installments/issue-due', IssueDueNoticesController::class)->name('rent.installments.issue-due');
        Route::post('/installments/{installment}/issue', IssueInstallmentNoticeController::class)->whereUuid('installment')->name('rent.installments.issue');
        Route::post('/installments/{installment}/cancel', CancelInstallmentController::class)->whereUuid('installment')->name('rent.installments.cancel');
        Route::post('/installments/{installment}/receipt', IssueInstallmentReceiptController::class)->whereUuid('installment')->name('rent.installments.receipt');
        Route::post('/receipts/issue-pending', IssuePendingReceiptsController::class)->name('rent.receipts.issue-pending');
    });
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:tenant', 'verified', 'throttle:60,1,tenant-rent'])->prefix('tenant/rent')->group(function (): void {
    Route::get('/installments', ListTenantInstallmentsController::class)->name('rent.tenant.installments.index');
    Route::get('/installments/{installment}', ShowTenantInstallmentController::class)->whereUuid('installment')->name('rent.tenant.installments.show');
    Route::get('/installments/{installment}/notice/download', DownloadTenantNoticeController::class)->whereUuid('installment')->name('rent.tenant.installments.notice.download');
    Route::get('/receipts', ListTenantReceiptsController::class)->name('rent.tenant.receipts.index');
    Route::get('/receipts/{receipt}', ShowTenantReceiptController::class)->whereUuid('receipt')->name('rent.tenant.receipts.show');
    Route::get('/receipts/{receipt}/download', DownloadTenantReceiptController::class)->whereUuid('receipt')->name('rent.tenant.receipts.download');
    Route::get('/payments', ListTenantPaymentsController::class)->name('rent.tenant.payments.index');
    Route::get('/payments/{payment}', ShowTenantPaymentController::class)->whereUuid('payment')->name('rent.tenant.payments.show');
});
