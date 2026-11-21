<?php

declare(strict_types=1);

use App\Modules\Payments\Http\Controllers\Organization\ListOnlinePaymentsController;
use App\Modules\Payments\Http\Controllers\Organization\OnboardPaymentAccountController;
use App\Modules\Payments\Http\Controllers\Organization\ShowPaymentAccountController;
use App\Modules\Payments\Http\Controllers\PaymentWebhookController;
use App\Modules\Payments\Http\Controllers\Tenant\CancelTenantOnlinePaymentController;
use App\Modules\Payments\Http\Controllers\Tenant\CreateTenantOnlinePaymentController;
use App\Modules\Payments\Http\Controllers\Tenant\ShowTenantOnlinePaymentController;
use App\Modules\Payments\Http\Controllers\Tenant\ShowTenantPaymentOptionsController;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Route;

Route::post('/webhooks/payments/{provider}', PaymentWebhookController::class)->where('provider', '[a-z0-9_-]{2,16}')->middleware('throttle:payments-webhook')->withoutMiddleware(ThrottleRequests::class.':api')->name('payments.webhooks.receive');

Route::middleware(['auth:sanctum', 'space:organization'])->prefix('org/{organization}')->group(function (): void {
    Route::middleware(['organization:owner,admin,manager,accountant', 'throttle:120,1,payments-lecture'])->group(function (): void {
        Route::get('/online-payments', ListOnlinePaymentsController::class)->name('payments.online-payments.index');
    });
    Route::middleware(['organization:owner,admin', 'throttle:60,1,payments-compte'])->get('/payments/account', ShowPaymentAccountController::class)->name('payments.account.show');
    Route::middleware(['organization:owner,admin', 'two-factor', 'reauthenticated:two-factor', 'throttle:10,1,payments-compte-ecriture'])->post('/payments/account', OnboardPaymentAccountController::class)->name('payments.account.store');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:tenant', 'verified', 'payments.private'])->prefix('tenant')->group(function (): void {
    Route::get('/online-payments/options', ShowTenantPaymentOptionsController::class)->middleware('throttle:60,1,tenant-payment-options')->name('payments.tenant.options');
    Route::post('/online-payments', CreateTenantOnlinePaymentController::class)->middleware(['throttle:10,60,tenant-online-payments-hour', 'throttle:30,1440,tenant-online-payments-day'])->name('payments.tenant.store');
    Route::get('/online-payments/{payment}', ShowTenantOnlinePaymentController::class)->whereUuid('payment')->middleware('throttle:120,1,tenant-online-payments-read')->name('payments.tenant.show');
    Route::post('/online-payments/{payment}/cancel', CancelTenantOnlinePaymentController::class)->whereUuid('payment')->middleware('throttle:10,60,tenant-online-payments-cancel')->name('payments.tenant.cancel');
});
