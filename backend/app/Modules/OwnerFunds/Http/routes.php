<?php

declare(strict_types=1);

use App\Modules\OwnerFunds\Http\Controllers\Organization\ApprovePayoutAccountRequestController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\CancelBatchController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\CloseMonthController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ConfirmTrustDepositController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ExcludeBatchItemController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ExecuteItemController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ExportBatchController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\FailItemController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\IncludeBatchItemController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ListBatchesController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ListFeeStatementsController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ListHoldsController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ListPayoutAccountRequestsController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ListTrustDepositsController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\PreviewPayoutsController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\RejectPayoutAccountRequestController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ReleaseHoldController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ReturnItemController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ShowBatchController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ShowMandantAccountController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ShowPayoutAccountProofController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ShowTrustCoverageController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\SimulateFeesController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\StoreBatchController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\StoreHoldController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\StoreTrustDepositController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\StoreTrustWithdrawalController;
use App\Modules\OwnerFunds\Http\Controllers\Organization\ValidateBatchController;
use App\Modules\OwnerFunds\Http\Controllers\Owner\ConfirmOwnerPayoutRequestController;
use App\Modules\OwnerFunds\Http\Controllers\Owner\ContestOwnerPayoutAccountController;
use App\Modules\OwnerFunds\Http\Controllers\Owner\ShowOwnerPayoutAccountController;
use App\Modules\OwnerFunds\Http\Controllers\Owner\StoreOwnerPayoutRequestController;
use App\Modules\OwnerFunds\Http\Controllers\Owner\WithdrawOwnerPayoutRequestController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:organization', 'ownerfunds.agency'])->prefix('org/{organization}')->group(function (): void {
    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:owner_funds', 'throttle:120,1,ownerfunds-lecture'])->group(function (): void {
        Route::get('/owner-funds/mandants/{mandant}/account', ShowMandantAccountController::class)->whereUuid('mandant')->name('ownerFunds.mandants.account');
        Route::get('/owner-funds/batches', ListBatchesController::class)->name('ownerFunds.batches.index');
        Route::get('/owner-funds/batches/{batch}', ShowBatchController::class)->whereUuid('batch')->name('ownerFunds.batches.show');
        Route::get('/owner-funds/holds', ListHoldsController::class)->name('ownerFunds.holds.index');
        Route::get('/owner-funds/fees', ListFeeStatementsController::class)->name('ownerFunds.fees.index');
        Route::get('/owner-funds/trust/deposits', ListTrustDepositsController::class)->name('ownerFunds.trust.deposits.index');
        Route::get('/owner-funds/trust/coverage', ShowTrustCoverageController::class)->name('ownerFunds.trust.coverage');
        Route::get('/owner-funds/payout-account-requests', ListPayoutAccountRequestsController::class)->name('ownerFunds.payoutAccountRequests.index');
    });

    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:owner_funds', 'throttle:20,1,ownerfunds-apercu'])->group(function (): void {
        Route::get('/owner-funds/payouts/preview', PreviewPayoutsController::class)->name('ownerFunds.payouts.preview');
    });

    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:owner_funds', 'throttle:20,1,ownerfunds-simulation'])->group(function (): void {
        Route::post('/owner-funds/fees/simulations', SimulateFeesController::class)->name('ownerFunds.fees.simulate');
    });

    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:owner_funds', 'throttle:60,1,ownerfunds-preparation'])->group(function (): void {
        Route::post('/owner-funds/batches', StoreBatchController::class)->name('ownerFunds.batches.store');
        Route::post('/owner-funds/batches/{batch}/items/{item}/include', IncludeBatchItemController::class)->whereUuid(['batch', 'item'])->name('ownerFunds.items.include');
        Route::post('/owner-funds/batches/{batch}/items/{item}/exclude', ExcludeBatchItemController::class)->whereUuid(['batch', 'item'])->name('ownerFunds.items.exclude');
        Route::post('/owner-funds/holds', StoreHoldController::class)->name('ownerFunds.holds.store');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:owner_funds', 'two-factor', 'throttle:20,1,ownerfunds-sensible'])->group(function (): void {
        Route::post('/owner-funds/holds/{hold}/release', ReleaseHoldController::class)->whereUuid('hold')->name('ownerFunds.holds.release');
        Route::post('/owner-funds/batches/{batch}/validate', ValidateBatchController::class)->whereUuid('batch')->name('ownerFunds.batches.validate');
        Route::post('/owner-funds/batches/{batch}/items/{item}/execute', ExecuteItemController::class)->whereUuid(['batch', 'item'])->name('ownerFunds.items.execute');
        Route::post('/owner-funds/batches/{batch}/items/{item}/fail', FailItemController::class)->whereUuid(['batch', 'item'])->name('ownerFunds.items.fail');
        Route::post('/owner-funds/batches/{batch}/items/{item}/return', ReturnItemController::class)->whereUuid(['batch', 'item'])->name('ownerFunds.items.return');
        Route::post('/owner-funds/batches/{batch}/cancel', CancelBatchController::class)->whereUuid('batch')->name('ownerFunds.batches.cancel');
        Route::post('/owner-funds/trust/withdrawals', StoreTrustWithdrawalController::class)->name('ownerFunds.trust.withdrawals.store');
        Route::post('/owner-funds/trust/deposits', StoreTrustDepositController::class)->name('ownerFunds.trust.deposits.store');
        Route::post('/owner-funds/trust/deposits/{deposit}/confirm', ConfirmTrustDepositController::class)->whereUuid('deposit')->name('ownerFunds.trust.deposits.confirm');
        Route::post('/accounting/periods/close', CloseMonthController::class)->name('ownerFunds.periods.close');
        Route::post('/owner-funds/payout-account-requests/{payoutRequest}/approve', ApprovePayoutAccountRequestController::class)->whereUuid('payoutRequest')->name('ownerFunds.payoutAccountRequests.approve');
        Route::post('/owner-funds/payout-account-requests/{payoutRequest}/reject', RejectPayoutAccountRequestController::class)->whereUuid('payoutRequest')->name('ownerFunds.payoutAccountRequests.reject');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:owner_funds', 'two-factor', 'throttle:10,1,ownerfunds-export'])->group(function (): void {
        Route::get('/owner-funds/batches/{batch}/export', ExportBatchController::class)->whereUuid('batch')->name('ownerFunds.batches.export');
        Route::get('/owner-funds/payout-account-requests/{payoutRequest}/proof', ShowPayoutAccountProofController::class)->whereUuid('payoutRequest')->name('ownerFunds.payoutAccountRequests.proof');
    });
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified'])->prefix('owner/payout-account')->group(function (): void {
    Route::get('/', ShowOwnerPayoutAccountController::class)->middleware('throttle:60,1,owner-reads')->name('ownerFunds.owner.account.show');

    Route::middleware(['web-session', 'throttle:3,60,owner-payout-request', 'two-factor', 'reauthenticated:two-factor'])->group(function (): void {
        Route::post('/requests', StoreOwnerPayoutRequestController::class)->name('ownerFunds.owner.requests.store');
    });

    Route::middleware(['web-session', 'throttle:10,1,owner-payout-sensible', 'two-factor'])->group(function (): void {
        Route::post('/requests/{payoutRequest}/confirm', ConfirmOwnerPayoutRequestController::class)->whereUuid('payoutRequest')->name('ownerFunds.owner.requests.confirm');
        Route::delete('/requests/{payoutRequest}', WithdrawOwnerPayoutRequestController::class)->whereUuid('payoutRequest')->name('ownerFunds.owner.requests.destroy');
        Route::post('/contest', ContestOwnerPayoutAccountController::class)->name('ownerFunds.owner.contest');
    });
});
