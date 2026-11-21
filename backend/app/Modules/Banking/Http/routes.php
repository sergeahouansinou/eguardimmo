<?php

declare(strict_types=1);

use App\Modules\Banking\Http\Controllers\Organization\AcceptSuggestionsController;
use App\Modules\Banking\Http\Controllers\Organization\BuildReconciliationController;
use App\Modules\Banking\Http\Controllers\Organization\CloseAccountController;
use App\Modules\Banking\Http\Controllers\Organization\DownloadReconciliationProofController;
use App\Modules\Banking\Http\Controllers\Organization\DownloadStatementFileController;
use App\Modules\Banking\Http\Controllers\Organization\IgnoreLineController;
use App\Modules\Banking\Http\Controllers\Organization\ImportStatementController;
use App\Modules\Banking\Http\Controllers\Organization\ListAccountsController;
use App\Modules\Banking\Http\Controllers\Organization\ListBookLinesController;
use App\Modules\Banking\Http\Controllers\Organization\ListLinesController;
use App\Modules\Banking\Http\Controllers\Organization\ListReconciliationsController;
use App\Modules\Banking\Http\Controllers\Organization\ListRulesController;
use App\Modules\Banking\Http\Controllers\Organization\ListStatementsController;
use App\Modules\Banking\Http\Controllers\Organization\ListSuggestionsController;
use App\Modules\Banking\Http\Controllers\Organization\MatchLineController;
use App\Modules\Banking\Http\Controllers\Organization\PreviewStatementController;
use App\Modules\Banking\Http\Controllers\Organization\ReplaceAccountController;
use App\Modules\Banking\Http\Controllers\Organization\RestoreLineController;
use App\Modules\Banking\Http\Controllers\Organization\SettleLineController;
use App\Modules\Banking\Http\Controllers\Organization\ShowAccountController;
use App\Modules\Banking\Http\Controllers\Organization\ShowLineController;
use App\Modules\Banking\Http\Controllers\Organization\ShowMatchController;
use App\Modules\Banking\Http\Controllers\Organization\ShowReconciliationController;
use App\Modules\Banking\Http\Controllers\Organization\ShowStatementController;
use App\Modules\Banking\Http\Controllers\Organization\StoreAccountController;
use App\Modules\Banking\Http\Controllers\Organization\StoreRuleController;
use App\Modules\Banking\Http\Controllers\Organization\UndoMatchController;
use App\Modules\Banking\Http\Controllers\Organization\UpdateAccountController;
use App\Modules\Banking\Http\Controllers\Organization\UpdateRuleController;
use App\Modules\Banking\Http\Controllers\Organization\ValidateReconciliationController;
use App\Modules\Banking\Http\Controllers\Organization\VoidStatementController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:organization'])->prefix('org/{organization}/banking')->group(function (): void {
    Route::middleware(['organization:owner,admin,accountant', 'entitled:banking', 'throttle:120,1,banking-lecture'])->group(function (): void {
        Route::get('/accounts', ListAccountsController::class)->name('banking.accounts.index');
        Route::get('/accounts/{account}', ShowAccountController::class)->whereUuid('account')->name('banking.accounts.show');
        Route::get('/statements', ListStatementsController::class)->name('banking.statements.index');
        Route::get('/statements/{statement}', ShowStatementController::class)->whereUuid('statement')->name('banking.statements.show');
        Route::get('/lines', ListLinesController::class)->name('banking.lines.index');
        Route::get('/lines/{line}', ShowLineController::class)->whereUuid('line')->name('banking.lines.show');
        Route::get('/suggestions', ListSuggestionsController::class)->name('banking.suggestions.index');
        Route::get('/book-lines', ListBookLinesController::class)->name('banking.bookLines.index');
        Route::get('/matches/{match}', ShowMatchController::class)->whereUuid('match')->name('banking.matches.show');
        Route::get('/reconciliations', ListReconciliationsController::class)->name('banking.reconciliations.index');
        Route::get('/reconciliations/{reconciliation}', ShowReconciliationController::class)->whereUuid('reconciliation')->name('banking.reconciliations.show');
        Route::get('/rules', ListRulesController::class)->name('banking.rules.index');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:banking', 'banking.two-factor', 'throttle:60,1,banking-ecriture'])->group(function (): void {
        Route::post('/lines/{line}/match', MatchLineController::class)->whereUuid('line')->name('banking.lines.match');
        Route::post('/lines/{line}/settle', SettleLineController::class)->whereUuid('line')->name('banking.lines.settle');
        Route::post('/lines/{line}/ignore', IgnoreLineController::class)->whereUuid('line')->name('banking.lines.ignore');
        Route::post('/lines/{line}/restore', RestoreLineController::class)->whereUuid('line')->name('banking.lines.restore');
        Route::post('/suggestions/accept', AcceptSuggestionsController::class)->name('banking.suggestions.accept');
        Route::post('/reconciliations', BuildReconciliationController::class)->name('banking.reconciliations.store');
        Route::post('/rules', StoreRuleController::class)->name('banking.rules.store');
        Route::put('/rules/{rule}', UpdateRuleController::class)->whereUuid('rule')->name('banking.rules.update');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:banking', 'banking.two-factor', 'throttle:60,1,banking-ecriture', 'throttle:banking-apercu'])->group(function (): void {
        Route::post('/accounts/{account}/statements/preview', PreviewStatementController::class)->whereUuid('account')->name('banking.statements.preview');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:banking', 'banking.two-factor', 'throttle:banking-import'])->group(function (): void {
        Route::post('/accounts/{account}/statements', ImportStatementController::class)->whereUuid('account')->name('banking.statements.import');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:banking', 'two-factor', 'throttle:20,1,banking-sensible'])->group(function (): void {
        Route::post('/matches/{match}/undo', UndoMatchController::class)->whereUuid('match')->name('banking.matches.undo');
        Route::post('/statements/{statement}/void', VoidStatementController::class)->whereUuid('statement')->name('banking.statements.void');
        Route::post('/reconciliations/{reconciliation}/validate', ValidateReconciliationController::class)->whereUuid('reconciliation')->name('banking.reconciliations.validate');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:banking', 'two-factor', 'throttle:10,1,banking-fichier'])->group(function (): void {
        Route::get('/statements/{statement}/file', DownloadStatementFileController::class)->whereUuid('statement')->name('banking.statements.file');
        Route::get('/reconciliations/{reconciliation}/proof', DownloadReconciliationProofController::class)->whereUuid('reconciliation')->name('banking.reconciliations.proof');
    });

    Route::middleware(['organization:owner,admin', 'entitled:banking', 'two-factor', 'reauthenticated:two-factor', 'throttle:10,1,banking-comptes'])->group(function (): void {
        Route::post('/accounts', StoreAccountController::class)->name('banking.accounts.store');
        Route::patch('/accounts/{account}', UpdateAccountController::class)->whereUuid('account')->name('banking.accounts.update');
        Route::post('/accounts/{account}/replace', ReplaceAccountController::class)->whereUuid('account')->name('banking.accounts.replace');
        Route::post('/accounts/{account}/close', CloseAccountController::class)->whereUuid('account')->name('banking.accounts.close');
    });
});
