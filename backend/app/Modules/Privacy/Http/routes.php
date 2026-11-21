<?php

declare(strict_types=1);

use App\Modules\Privacy\Http\Controllers\Console\CompletePrivacyRequestController;
use App\Modules\Privacy\Http\Controllers\Console\ExtendPrivacyRequestController;
use App\Modules\Privacy\Http\Controllers\Console\ForwardPrivacyRequestController;
use App\Modules\Privacy\Http\Controllers\Console\ListConsolePrivacyRequestsController;
use App\Modules\Privacy\Http\Controllers\Console\RecordPrivacyRequestController;
use App\Modules\Privacy\Http\Controllers\Console\RefusePrivacyRequestController;
use App\Modules\Privacy\Http\Controllers\Console\ShowConsolePrivacyRequestController;
use App\Modules\Privacy\Http\Controllers\Console\VerifyPrivacyRequestController;
use App\Modules\Privacy\Http\Controllers\DownloadPrivacyExportController;
use App\Modules\Privacy\Http\Controllers\ListMyPrivacyRequestsController;
use App\Modules\Privacy\Http\Controllers\Organization\ListOrganizationPrivacyRequestsController;
use App\Modules\Privacy\Http\Controllers\Organization\MarkPrivacyRequestHandledController;
use App\Modules\Privacy\Http\Controllers\ShowMyPrivacyRequestController;
use App\Modules\Privacy\Http\Controllers\StorePrivacyRequestController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'no-operator-token', 'verified', 'privacy.private'])->prefix('privacy')->group(function (): void {
    Route::post('/requests', StorePrivacyRequestController::class)->middleware('throttle:3,1440,privacy-request-create')->name('privacy.requests.store');
    Route::middleware('throttle:60,1,privacy-requests-read')->group(function (): void {
        Route::get('/requests', ListMyPrivacyRequestsController::class)->name('privacy.requests.index');
        Route::get('/requests/{privacyRequest}', ShowMyPrivacyRequestController::class)->whereUuid('privacyRequest')->name('privacy.requests.show');
    });
    Route::get('/requests/{privacyRequest}/export', DownloadPrivacyExportController::class)->whereUuid('privacyRequest')->middleware(['web-session', 'reauthenticated', 'throttle:10,60,privacy-export-download'])->name('privacy.requests.export');
});

Route::middleware(['auth:sanctum', 'space:organization', 'organization', 'privacy.private'])->prefix('org/{organization}')->group(function (): void {
    Route::get('/privacy-requests', ListOrganizationPrivacyRequestsController::class)->middleware('throttle:60,1,org-privacy-read')->name('privacy.org.requests.index');
    Route::post('/privacy-requests/{forward}/handled', MarkPrivacyRequestHandledController::class)->whereUuid('forward')->middleware('throttle:30,60,org-privacy-handle')->name('privacy.org.requests.handled');
});

Route::middleware(['auth:sanctum', 'space:operator', 'privacy.private'])->prefix('console/privacy-requests')->group(function (): void {
    Route::middleware(['operator:admin,compliance', 'throttle:console-read'])->group(function (): void {
        Route::get('/', ListConsolePrivacyRequestsController::class)->name('privacy.console.requests.index');
        Route::get('/{privacyRequest}', ShowConsolePrivacyRequestController::class)->whereUuid('privacyRequest')->name('privacy.console.requests.show');
    });
    Route::middleware(['operator:compliance', 'throttle:console-write', 'operator-proof'])->group(function (): void {
        Route::post('/', RecordPrivacyRequestController::class)->name('privacy.console.requests.store');
        Route::post('/{privacyRequest}/verify', VerifyPrivacyRequestController::class)->whereUuid('privacyRequest')->name('privacy.console.requests.verify');
        Route::post('/{privacyRequest}/extend', ExtendPrivacyRequestController::class)->whereUuid('privacyRequest')->name('privacy.console.requests.extend');
        Route::post('/{privacyRequest}/forward', ForwardPrivacyRequestController::class)->whereUuid('privacyRequest')->name('privacy.console.requests.forward');
        Route::post('/{privacyRequest}/complete', CompletePrivacyRequestController::class)->whereUuid('privacyRequest')->name('privacy.console.requests.complete');
        Route::post('/{privacyRequest}/refuse', RefusePrivacyRequestController::class)->whereUuid('privacyRequest')->name('privacy.console.requests.refuse');
    });
});
