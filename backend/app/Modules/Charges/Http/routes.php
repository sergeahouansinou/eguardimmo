<?php

declare(strict_types=1);

use App\Modules\Charges\Http\Controllers\Organization\ApproveExpenseController;
use App\Modules\Charges\Http\Controllers\Organization\ArchiveChargeKeyController;
use App\Modules\Charges\Http\Controllers\Organization\CancelExpenseController;
use App\Modules\Charges\Http\Controllers\Organization\ComputeExerciseController;
use App\Modules\Charges\Http\Controllers\Organization\DiscardExerciseController;
use App\Modules\Charges\Http\Controllers\Organization\DownloadExpenseFileController;
use App\Modules\Charges\Http\Controllers\Organization\DownloadStatementPdfController;
use App\Modules\Charges\Http\Controllers\Organization\ExportExpensesCsvController;
use App\Modules\Charges\Http\Controllers\Organization\ExportStatementsCsvController;
use App\Modules\Charges\Http\Controllers\Organization\IssueExerciseController;
use App\Modules\Charges\Http\Controllers\Organization\ListChargeKeysController;
use App\Modules\Charges\Http\Controllers\Organization\ListExercisesController;
use App\Modules\Charges\Http\Controllers\Organization\ListExpensesController;
use App\Modules\Charges\Http\Controllers\Organization\RecordInstallmentPlanController;
use App\Modules\Charges\Http\Controllers\Organization\RectifyStatementController;
use App\Modules\Charges\Http\Controllers\Organization\RetryStatementController;
use App\Modules\Charges\Http\Controllers\Organization\ShareStatementFileController;
use App\Modules\Charges\Http\Controllers\Organization\ShowExerciseController;
use App\Modules\Charges\Http\Controllers\Organization\ShowExpenseController;
use App\Modules\Charges\Http\Controllers\Organization\ShowStatementController;
use App\Modules\Charges\Http\Controllers\Organization\StoreChargeKeyController;
use App\Modules\Charges\Http\Controllers\Organization\StoreChargeKeyVersionController;
use App\Modules\Charges\Http\Controllers\Organization\StoreExerciseController;
use App\Modules\Charges\Http\Controllers\Organization\StoreExpenseController;
use App\Modules\Charges\Http\Controllers\Organization\StoreExpenseFileController;
use App\Modules\Charges\Http\Controllers\Organization\UpdateExerciseController;
use App\Modules\Charges\Http\Controllers\Owner\ListOwnerStatementsController;
use App\Modules\Charges\Http\Controllers\Owner\ShowOwnerStatementController;
use App\Modules\Charges\Http\Controllers\Tenant\DownloadTenantStatementController;
use App\Modules\Charges\Http\Controllers\Tenant\DownloadTenantStatementFileController;
use App\Modules\Charges\Http\Controllers\Tenant\ListTenantStatementsController;
use App\Modules\Charges\Http\Controllers\Tenant\ShowTenantStatementController;
use Illuminate\Support\Facades\Route;

$uuids = ['expense', 'file', 'property', 'key', 'exercise', 'statement'];

Route::middleware(['auth:sanctum', 'space:organization', 'no-operator-token', 'charges.private'])->prefix('org/{organization}/charges')->group(function () use ($uuids): void {
    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:charges', 'throttle:120,1,charges-lecture'])->group(function () use ($uuids): void {
        Route::get('/expenses', ListExpensesController::class)->name('charges.expenses.index');
        Route::get('/properties/{property}/charge-keys', ListChargeKeysController::class)->whereUuid($uuids)->name('charges.keys.index');
        Route::get('/expenses/{expense}', ShowExpenseController::class)->whereUuid($uuids)->name('charges.expenses.show');
        Route::get('/expenses/{expense}/files/{file}', DownloadExpenseFileController::class)->whereUuid($uuids)->name('charges.expenses.files.download');
        Route::get('/exercises', ListExercisesController::class)->name('charges.exercises.index');
        Route::get('/exercises/{exercise}', ShowExerciseController::class)->whereUuid($uuids)->name('charges.exercises.show');
        Route::get('/statements/{statement}', ShowStatementController::class)->whereUuid($uuids)->name('charges.statements.show');
        Route::get('/statements/{statement}/pdf', DownloadStatementPdfController::class)->whereUuid($uuids)->name('charges.statements.pdf');
    });

    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:charges', 'throttle:60,1,charges-ecriture'])->group(function () use ($uuids): void {
        Route::post('/expenses', StoreExpenseController::class)->name('charges.expenses.store');
        Route::post('/properties/{property}/charge-keys', StoreChargeKeyController::class)->whereUuid($uuids)->name('charges.keys.store');
        Route::post('/properties/{property}/charge-keys/{key}/versions', StoreChargeKeyVersionController::class)->whereUuid($uuids)->name('charges.keys.versions.store');
        Route::post('/properties/{property}/charge-keys/{key}/archive', ArchiveChargeKeyController::class)->whereUuid($uuids)->name('charges.keys.archive');
        Route::post('/expenses/{expense}/files', StoreExpenseFileController::class)->whereUuid($uuids)->name('charges.expenses.files.store');
        Route::post('/exercises', StoreExerciseController::class)->name('charges.exercises.store');
        Route::patch('/exercises/{exercise}', UpdateExerciseController::class)->whereUuid($uuids)->name('charges.exercises.update');
        Route::post('/exercises/{exercise}/compute', ComputeExerciseController::class)->whereUuid($uuids)->name('charges.exercises.compute');
        Route::post('/exercises/{exercise}/discard', DiscardExerciseController::class)->whereUuid($uuids)->name('charges.exercises.discard');
    });

    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:charges', 'throttle:20,1,charges-fonds-de-tiers'])->group(function () use ($uuids): void {
        Route::post('/expenses/{expense}/cancel', CancelExpenseController::class)->whereUuid($uuids)->name('charges.expenses.cancel');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:charges', 'two-factor', 'reauthenticated:two-factor', 'throttle:20,1,charges-fonds-de-tiers'])->group(function () use ($uuids): void {
        Route::post('/expenses/{expense}/approve', ApproveExpenseController::class)->whereUuid($uuids)->name('charges.expenses.approve');
    });
    Route::middleware(['organization:owner,admin,manager', 'entitled:charges', 'throttle:20,1,charges-emission'])->group(function () use ($uuids): void {
        Route::post('/exercises/{exercise}/issue', IssueExerciseController::class)->whereUuid($uuids)->name('charges.exercises.issue');
        Route::post('/statements/{statement}/retry', RetryStatementController::class)->whereUuid($uuids)->name('charges.statements.retry');
        Route::post('/statements/{statement}/rectify', RectifyStatementController::class)->whereUuid($uuids)->name('charges.statements.rectify');
        Route::post('/statements/{statement}/installment-plan', RecordInstallmentPlanController::class)->whereUuid($uuids)->name('charges.statements.plan');
        Route::patch('/statements/{statement}/files/{file}', ShareStatementFileController::class)->whereUuid($uuids)->name('charges.statements.files.share');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:charges', 'throttle:10,1,charges-export'])->group(function () use ($uuids): void {
        Route::get('/exercises/{exercise}/statements.csv', ExportStatementsCsvController::class)->whereUuid($uuids)->name('charges.exercises.statements.export');
        Route::get('/expenses.csv', ExportExpensesCsvController::class)->name('charges.expenses.export');
    });
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:tenant', 'verified', 'throttle:60,1,tenant-charges', 'charges.private'])->prefix('tenant/charge-statements')->group(function (): void {
    Route::get('/', ListTenantStatementsController::class)->name('charges.tenant.statements.index');
    Route::get('/{statement}', ShowTenantStatementController::class)->whereUuid('statement')->name('charges.tenant.statements.show');
    Route::get('/{statement}/pdf', DownloadTenantStatementController::class)->whereUuid('statement')->name('charges.tenant.statements.pdf');
    Route::get('/{statement}/files/{file}', DownloadTenantStatementFileController::class)->whereUuid(['statement', 'file'])->name('charges.tenant.statements.files.download');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'throttle:60,1,owner-reads', 'charges.private'])->prefix('owner/charge-statements')->group(function (): void {
    Route::get('/', ListOwnerStatementsController::class)->name('charges.owner.statements.index');
    Route::get('/{statement}', ShowOwnerStatementController::class)->whereUuid('statement')->name('charges.owner.statements.show');
});
