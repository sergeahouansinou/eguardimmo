<?php

declare(strict_types=1);

use App\Modules\Tax\Http\Controllers\Organization\DownloadMandantStatementPdfController;
use App\Modules\Tax\Http\Controllers\Organization\DownloadSummaryPdfController;
use App\Modules\Tax\Http\Controllers\Organization\ExportMandantStatementLinesController;
use App\Modules\Tax\Http\Controllers\Organization\ExportSummaryLinesController;
use App\Modules\Tax\Http\Controllers\Organization\ListMandantStatementsController;
use App\Modules\Tax\Http\Controllers\Organization\ListSummariesController;
use App\Modules\Tax\Http\Controllers\Organization\PublishMandantStatementController;
use App\Modules\Tax\Http\Controllers\Organization\RectifyMandantStatementController;
use App\Modules\Tax\Http\Controllers\Organization\RectifySummaryController;
use App\Modules\Tax\Http\Controllers\Organization\ShowMandantStatementController;
use App\Modules\Tax\Http\Controllers\Organization\ShowRentalIncomeController;
use App\Modules\Tax\Http\Controllers\Organization\ShowSummaryController;
use App\Modules\Tax\Http\Controllers\Organization\StoreMandantStatementsController;
use App\Modules\Tax\Http\Controllers\Organization\StoreSummaryController;
use App\Modules\Tax\Http\Controllers\Owner\DownloadOwnerTaxStatementPdfController;
use App\Modules\Tax\Http\Controllers\Owner\ListOwnerTaxStatementsController;
use App\Modules\Tax\Http\Controllers\Owner\ShowOwnerTaxStatementController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:organization', 'tax.private'])->prefix('org/{organization}/tax')->group(function (): void {
    Route::middleware(['organization:owner,admin,manager,accountant', 'tax.landlord'])->group(function (): void {
        Route::middleware('throttle:120,1,tax-lecture')->group(function (): void {
            Route::get('/rental-income/{year}', ShowRentalIncomeController::class)->where('year', '20\d{2}')->name('tax.rentalIncome.show');
            Route::get('/summaries', ListSummariesController::class)->name('tax.summaries.index');
            Route::get('/summaries/{summary}', ShowSummaryController::class)->whereUuid('summary')->name('tax.summaries.show');
        });
    });

    Route::middleware(['organization:owner,admin,accountant', 'tax.landlord', 'throttle:20,1,tax-ecriture'])->group(function (): void {
        Route::post('/summaries', StoreSummaryController::class)->name('tax.summaries.store');
        Route::post('/summaries/{summary}/rectify', RectifySummaryController::class)->whereUuid('summary')->name('tax.summaries.rectify');
    });

    Route::middleware(['organization:owner,admin,accountant', 'tax.landlord', 'tax.two-factor-agency', 'throttle:10,1,tax-export'])->group(function (): void {
        Route::get('/summaries/{summary}/pdf', DownloadSummaryPdfController::class)->whereUuid('summary')->name('tax.summaries.pdf');
        Route::get('/summaries/{summary}/lines.csv', ExportSummaryLinesController::class)->whereUuid('summary')->name('tax.summaries.lines');
    });
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:organization', 'tax.private'])->prefix('org/{organization}/tax')->group(function (): void {
    Route::middleware(['organization:owner,admin,manager,accountant', 'tax.agency', 'throttle:120,1,tax-lecture-agence'])->group(function (): void {
        Route::get('/mandant-statements', ListMandantStatementsController::class)->name('tax.mandantStatements.index');
        Route::get('/mandant-statements/{statement}', ShowMandantStatementController::class)->whereUuid('statement')->name('tax.mandantStatements.show');
    });

    Route::middleware(['organization:owner,admin,accountant', 'tax.agency', 'throttle:20,1,tax-ecriture-agence'])->group(function (): void {
        Route::post('/mandant-statements', StoreMandantStatementsController::class)->name('tax.mandantStatements.store');
        Route::post('/mandant-statements/{statement}/rectify', RectifyMandantStatementController::class)->whereUuid('statement')->name('tax.mandantStatements.rectify');
    });

    Route::middleware(['organization:owner,admin,manager', 'tax.agency', 'two-factor', 'throttle:20,1,tax-publication'])->group(function (): void {
        Route::post('/mandant-statements/{statement}/publish', PublishMandantStatementController::class)->whereUuid('statement')->name('tax.mandantStatements.publish');
    });

    Route::middleware(['organization:owner,admin,accountant', 'tax.agency', 'two-factor', 'throttle:10,1,tax-export-agence'])->group(function (): void {
        Route::get('/mandant-statements/{statement}/pdf', DownloadMandantStatementPdfController::class)->whereUuid('statement')->name('tax.mandantStatements.pdf');
        Route::get('/mandant-statements/{statement}/lines.csv', ExportMandantStatementLinesController::class)->whereUuid('statement')->name('tax.mandantStatements.lines');
    });
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'tax.private', 'throttle:60,1,tax-owner-lecture'])->prefix('owner')->group(function (): void {
    Route::get('/tax-statements', ListOwnerTaxStatementsController::class)->name('tax.owner.statements.index');
    Route::get('/tax-statements/{statement}', ShowOwnerTaxStatementController::class)->whereUuid('statement')->name('tax.owner.statements.show');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'tax.private', 'throttle:30,1,tax-owner-pdf'])->prefix('owner')->group(function (): void {
    Route::get('/tax-statements/{statement}/pdf', DownloadOwnerTaxStatementPdfController::class)->whereUuid('statement')->name('tax.owner.statements.pdf');
});
