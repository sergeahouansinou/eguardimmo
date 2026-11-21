<?php

declare(strict_types=1);

use App\Modules\Reporting\Http\Controllers\Console\ShowConsoleOverviewController;
use App\Modules\Reporting\Http\Controllers\Organization\DiscardReportController;
use App\Modules\Reporting\Http\Controllers\Organization\DownloadReportPdfController;
use App\Modules\Reporting\Http\Controllers\Organization\ExportFinanceController;
use App\Modules\Reporting\Http\Controllers\Organization\ExportReportLinesController;
use App\Modules\Reporting\Http\Controllers\Organization\GenerateReportController;
use App\Modules\Reporting\Http\Controllers\Organization\ListReportsController;
use App\Modules\Reporting\Http\Controllers\Organization\PublishReportController;
use App\Modules\Reporting\Http\Controllers\Organization\RectifyReportController;
use App\Modules\Reporting\Http\Controllers\Organization\ShowAgencyAlertsController;
use App\Modules\Reporting\Http\Controllers\Organization\ShowAgencyKpisController;
use App\Modules\Reporting\Http\Controllers\Organization\ShowAgencyPayoutsController;
use App\Modules\Reporting\Http\Controllers\Organization\ShowAgingController;
use App\Modules\Reporting\Http\Controllers\Organization\ShowForecastController;
use App\Modules\Reporting\Http\Controllers\Organization\ShowLandlordHomeController;
use App\Modules\Reporting\Http\Controllers\Organization\ShowMandantStatementController;
use App\Modules\Reporting\Http\Controllers\Organization\ShowOccupancyController;
use App\Modules\Reporting\Http\Controllers\Organization\ShowProfitabilityController;
use App\Modules\Reporting\Http\Controllers\Organization\ShowReportController;
use App\Modules\Reporting\Http\Controllers\Organization\ShowRevenueExpensesController;
use App\Modules\Reporting\Http\Controllers\Organization\StoreReportsController;
use App\Modules\Reporting\Http\Controllers\Organization\UnscheduleReportController;
use App\Modules\Reporting\Http\Controllers\Organization\UpdateForecastAssumptionsController;
use App\Modules\Reporting\Http\Controllers\Organization\UpdateReportController;
use App\Modules\Reporting\Http\Controllers\Owner\DownloadOwnerReportPdfController;
use App\Modules\Reporting\Http\Controllers\Owner\ListOwnerPayoutsController;
use App\Modules\Reporting\Http\Controllers\Owner\ListOwnerReportsController;
use App\Modules\Reporting\Http\Controllers\Owner\MarkOwnerReportReadController;
use App\Modules\Reporting\Http\Controllers\Owner\ShowOwnerHomeController;
use App\Modules\Reporting\Http\Controllers\Owner\ShowOwnerRentController;
use App\Modules\Reporting\Http\Controllers\Owner\ShowOwnerReportController;
use App\Modules\Reporting\Http\Controllers\Owner\ShowOwnerStatementController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:organization', 'reporting.private'])->prefix('org/{organization}/reporting')->group(function (): void {
    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:reporting', 'throttle:120,1,reporting-cartes'])->group(function (): void {
        Route::get('/home/landlord', ShowLandlordHomeController::class)->name('reporting.home.landlord');
        Route::get('/finance/aging', ShowAgingController::class)->name('reporting.finance.aging');
        Route::get('/finance/revenue-expenses', ShowRevenueExpensesController::class)->name('reporting.finance.revenueExpenses');
        Route::get('/finance/occupancy', ShowOccupancyController::class)->name('reporting.finance.occupancy');
    });

    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:reporting', 'reporting.landlord', 'throttle:120,1,reporting-finance-bailleur'])->group(function (): void {
        Route::get('/finance/profitability', ShowProfitabilityController::class)->name('reporting.finance.profitability');
        Route::get('/finance/forecast', ShowForecastController::class)->name('reporting.finance.forecast');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:reporting', 'reporting.landlord', 'throttle:60,1,reporting-hypotheses'])->group(function (): void {
        Route::put('/finance/forecast/assumptions', UpdateForecastAssumptionsController::class)->name('reporting.forecast.assumptions');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:reporting', 'reporting.landlord', 'throttle:10,1,reporting-export-finance'])->group(function (): void {
        Route::get('/exports/{type}', ExportFinanceController::class)->name('reporting.finance.exports');
    });

    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:reporting', 'reporting.agency', 'throttle:120,1,reporting-cartes-agence'])->group(function (): void {
        Route::get('/home/agency-kpis', ShowAgencyKpisController::class)->name('reporting.home.agencyKpis');
        Route::get('/home/agency-payouts', ShowAgencyPayoutsController::class)->name('reporting.home.agencyPayouts');
        Route::get('/home/agency-alerts', ShowAgencyAlertsController::class)->name('reporting.home.agencyAlerts');
    });

    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:reporting', 'reporting.agency:jurisdiction'])->group(function (): void {
        Route::middleware('throttle:120,1,reporting-lecture')->group(function (): void {
            Route::get('/management-reports', ListReportsController::class)->name('reporting.reports.index');
            Route::get('/management-reports/{report}', ShowReportController::class)->whereUuid('report')->name('reporting.reports.show');
            Route::get('/mandants/{mandant}/statement', ShowMandantStatementController::class)->whereUuid('mandant')->name('reporting.mandants.statement');
        });

        Route::middleware('throttle:60,1,reporting-ecriture')->group(function (): void {
            Route::post('/management-reports', StoreReportsController::class)->name('reporting.reports.store');
            Route::patch('/management-reports/{report}', UpdateReportController::class)->whereUuid('report')->name('reporting.reports.update');
            Route::post('/management-reports/{report}/generate', GenerateReportController::class)->whereUuid('report')->name('reporting.reports.generate');
            Route::post('/management-reports/{report}/discard', DiscardReportController::class)->whereUuid('report')->name('reporting.reports.discard');
        });

        Route::middleware('throttle:60,1,reporting-pdf')->get('/management-reports/{report}/pdf', DownloadReportPdfController::class)->whereUuid('report')->name('reporting.reports.pdf');
    });

    Route::middleware(['organization:owner,admin,manager', 'entitled:reporting', 'reporting.agency:jurisdiction', 'throttle:60,1,reporting-publication'])->group(function (): void {
        Route::post('/management-reports/{report}/publish', PublishReportController::class)->whereUuid('report')->name('reporting.reports.publish');
        Route::delete('/management-reports/{report}/schedule', UnscheduleReportController::class)->whereUuid('report')->name('reporting.reports.unschedule');
        Route::post('/management-reports/{report}/rectify', RectifyReportController::class)->whereUuid('report')->name('reporting.reports.rectify');
    });

    Route::middleware(['organization:owner,admin,accountant', 'entitled:reporting', 'reporting.agency:jurisdiction', 'two-factor', 'throttle:10,1,reporting-export'])->group(function (): void {
        Route::get('/management-reports/{report}/lines.csv', ExportReportLinesController::class)->whereUuid('report')->name('reporting.reports.lines');
    });
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'throttle:60,1,owner-reads'])->prefix('owner')->group(function (): void {
    Route::get('/home', ShowOwnerHomeController::class)->name('reporting.owner.home');
    Route::get('/statement', ShowOwnerStatementController::class)->name('reporting.owner.statement');
    Route::get('/management-reports', ListOwnerReportsController::class)->name('reporting.owner.reports.index');
    Route::get('/management-reports/{report}', ShowOwnerReportController::class)->whereUuid('report')->name('reporting.owner.reports.show');
    Route::get('/payouts', ListOwnerPayoutsController::class)->name('reporting.owner.payouts.index');
    Route::get('/rent/{month}', ShowOwnerRentController::class)->where('month', '(19|20)\d{2}-(0[1-9]|1[0-2])')->name('reporting.owner.rent.show');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'throttle:30,1,owner-downloads'])->prefix('owner')->group(function (): void {
    Route::get('/management-reports/{report}/pdf', DownloadOwnerReportPdfController::class)->whereUuid('report')->name('reporting.owner.reports.pdf');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'web-session', 'throttle:60,1,owner-report-read'])->prefix('owner')->group(function (): void {
    Route::post('/management-reports/{report}/read', MarkOwnerReportReadController::class)->whereUuid('report')->name('reporting.owner.reports.read');
});

Route::middleware(['auth:sanctum', 'space:operator', 'operator:admin,support,compliance,billing', 'reporting.private', 'throttle:console-read'])->prefix('console')->group(function (): void {
    Route::get('/overview', ShowConsoleOverviewController::class)->name('reporting.console.overview');
});
