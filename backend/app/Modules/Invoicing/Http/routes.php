<?php

declare(strict_types=1);

use App\Modules\Invoicing\Http\Controllers\Organization\CancelInvoicePaymentController;
use App\Modules\Invoicing\Http\Controllers\Organization\DiscardInvoiceController;
use App\Modules\Invoicing\Http\Controllers\Organization\DownloadInvoiceController;
use App\Modules\Invoicing\Http\Controllers\Organization\IssueInvoiceController;
use App\Modules\Invoicing\Http\Controllers\Organization\ListInvoicesController;
use App\Modules\Invoicing\Http\Controllers\Organization\RecordInvoicePaymentController;
use App\Modules\Invoicing\Http\Controllers\Organization\SendInvoiceController;
use App\Modules\Invoicing\Http\Controllers\Organization\ShowInvoiceController;
use App\Modules\Invoicing\Http\Controllers\Organization\StoreCreditNoteController;
use App\Modules\Invoicing\Http\Controllers\Organization\StoreInvoiceController;
use App\Modules\Invoicing\Http\Controllers\Organization\UpdateInvoiceController;
use App\Modules\Invoicing\Http\Controllers\Owner\DownloadOwnerInvoiceController;
use App\Modules\Invoicing\Http\Controllers\Owner\ListOwnerInvoicesController;
use App\Modules\Invoicing\Http\Controllers\Owner\ShowOwnerInvoiceController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'space:organization'])->prefix('org/{organization}')->group(function (): void {
    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:invoicing', 'invoicing.agency', 'invoicing.private', 'throttle:120,1,invoicing-lecture'])->group(function (): void {
        Route::get('/invoices', ListInvoicesController::class)->name('invoicing.invoices.index');
        Route::get('/invoices/{invoice}', ShowInvoiceController::class)->whereUuid('invoice')->name('invoicing.invoices.show');
        Route::get('/invoices/{invoice}/pdf', DownloadInvoiceController::class)->whereUuid('invoice')->name('invoicing.invoices.pdf');
    });

    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:invoicing', 'invoicing.agency', 'invoicing.private', 'throttle:60,1,invoicing-ecriture'])->group(function (): void {
        Route::post('/invoices', StoreInvoiceController::class)->name('invoicing.invoices.store');
        Route::patch('/invoices/{invoice}', UpdateInvoiceController::class)->whereUuid('invoice')->name('invoicing.invoices.update');
        Route::post('/invoices/{invoice}/discard', DiscardInvoiceController::class)->whereUuid('invoice')->name('invoicing.invoices.discard');
        Route::post('/invoices/{invoice}/issue', IssueInvoiceController::class)->whereUuid('invoice')->name('invoicing.invoices.issue');
        Route::post('/invoices/{invoice}/payments', RecordInvoicePaymentController::class)->whereUuid('invoice')->name('invoicing.invoices.payments.store');
        Route::post('/invoice-payments/{payment}/cancel', CancelInvoicePaymentController::class)->whereUuid('payment')->name('invoicing.payments.cancel');
        Route::post('/invoices/{invoice}/send', SendInvoiceController::class)->whereUuid('invoice')->middleware(['throttle:10,1,invoicing-envoi', 'throttle:invoicing-send'])->name('invoicing.invoices.send');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:invoicing', 'invoicing.agency', 'invoicing.private', 'throttle:60,1,invoicing-avoir'])->group(function (): void {
        Route::post('/invoices/{invoice}/credit-notes', StoreCreditNoteController::class)->whereUuid('invoice')->name('invoicing.invoices.credit-notes.store');
    });
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'throttle:60,1,owner-reads'])->prefix('owner')->group(function (): void {
    Route::get('/invoices', ListOwnerInvoicesController::class)->name('invoicing.owner.invoices.index');
    Route::get('/invoices/{invoice}', ShowOwnerInvoiceController::class)->whereUuid('invoice')->name('invoicing.owner.invoices.show');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'throttle:30,1,owner-downloads'])->prefix('owner')->group(function (): void {
    Route::get('/invoices/{invoice}/download', DownloadOwnerInvoiceController::class)->whereUuid('invoice')->name('invoicing.owner.invoices.download');
});
