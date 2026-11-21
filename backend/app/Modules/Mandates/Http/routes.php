<?php

declare(strict_types=1);

use App\Modules\Mandates\Http\Controllers\Organization\ActivateMandateController;
use App\Modules\Mandates\Http\Controllers\Organization\AddMandateUnitController;
use App\Modules\Mandates\Http\Controllers\Organization\AmendMandateTermsController;
use App\Modules\Mandates\Http\Controllers\Organization\ArchiveMandateController;
use App\Modules\Mandates\Http\Controllers\Organization\CreateMandateController;
use App\Modules\Mandates\Http\Controllers\Organization\DismissMandateEndRequestController;
use App\Modules\Mandates\Http\Controllers\Organization\EndMandateUnitController;
use App\Modules\Mandates\Http\Controllers\Organization\ListMandantsController;
use App\Modules\Mandates\Http\Controllers\Organization\ListMandateDocumentsController;
use App\Modules\Mandates\Http\Controllers\Organization\ListMandatesController;
use App\Modules\Mandates\Http\Controllers\Organization\RemoveMandateUnitController;
use App\Modules\Mandates\Http\Controllers\Organization\RenewMandateController;
use App\Modules\Mandates\Http\Controllers\Organization\RestoreMandateController;
use App\Modules\Mandates\Http\Controllers\Organization\ResumeMandateController;
use App\Modules\Mandates\Http\Controllers\Organization\ShareMandateDocumentController;
use App\Modules\Mandates\Http\Controllers\Organization\ShowMandateController;
use App\Modules\Mandates\Http\Controllers\Organization\ShowMandateEndRequestController;
use App\Modules\Mandates\Http\Controllers\Organization\ShowMandateTermDefaultsController;
use App\Modules\Mandates\Http\Controllers\Organization\SuspendMandateController;
use App\Modules\Mandates\Http\Controllers\Organization\TerminateMandateController;
use App\Modules\Mandates\Http\Controllers\Organization\UnshareMandateDocumentController;
use App\Modules\Mandates\Http\Controllers\Organization\UpdateMandateController;
use App\Modules\Mandates\Http\Controllers\Organization\UpdateMandateTermDefaultsController;
use App\Modules\Mandates\Http\Controllers\Owner\CancelOwnerMandateEndRequestController;
use App\Modules\Mandates\Http\Controllers\Owner\DownloadOwnerDocumentController;
use App\Modules\Mandates\Http\Controllers\Owner\ListOwnerAgenciesController;
use App\Modules\Mandates\Http\Controllers\Owner\ListOwnerDocumentsController;
use App\Modules\Mandates\Http\Controllers\Owner\ListOwnerMandatesController;
use App\Modules\Mandates\Http\Controllers\Owner\ListOwnerPropertiesController;
use App\Modules\Mandates\Http\Controllers\Owner\ShowOwnerMandateController;
use App\Modules\Mandates\Http\Controllers\Owner\ShowOwnerPropertyController;
use App\Modules\Mandates\Http\Controllers\Owner\StoreOwnerMandateEndRequestController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'space:organization'])->prefix('org/{organization}')->group(function (): void {
    Route::middleware(['organization', 'entitled:mandates', 'mandates.agency', 'throttle:120,1,mandates-lecture'])->group(function (): void {
        Route::get('/mandates', ListMandatesController::class)->name('mandates.index');
        Route::get('/mandates/mandants', ListMandantsController::class)->name('mandates.mandants.index');
        Route::get('/mandates/term-defaults', ShowMandateTermDefaultsController::class)->name('mandates.term-defaults.show');
        Route::get('/mandates/{mandate}', ShowMandateController::class)->whereUuid('mandate')->name('mandates.show');
        Route::get('/mandates/{mandate}/end-request', ShowMandateEndRequestController::class)->whereUuid('mandate')->name('mandates.end-request.show');
    });

    Route::middleware(['organization:owner,admin', 'entitled:mandates', 'mandates.agency', 'throttle:20,1,mandates-defauts'])->group(function (): void {
        Route::put('/mandates/term-defaults', UpdateMandateTermDefaultsController::class)->name('mandates.term-defaults.update');
    });

    Route::middleware(['organization:owner,admin,manager', 'entitled:mandates', 'mandates.agency', 'throttle:60,1'])->group(function (): void {
        Route::post('/mandates', CreateMandateController::class)->name('mandates.store');
        Route::patch('/mandates/{mandate}', UpdateMandateController::class)->whereUuid('mandate')->name('mandates.update');
        Route::post('/mandates/{mandate}/activate', ActivateMandateController::class)->whereUuid('mandate')->name('mandates.activate');
        Route::post('/mandates/{mandate}/suspend', SuspendMandateController::class)->whereUuid('mandate')->name('mandates.suspend');
        Route::post('/mandates/{mandate}/resume', ResumeMandateController::class)->whereUuid('mandate')->name('mandates.resume');
        Route::post('/mandates/{mandate}/terminate', TerminateMandateController::class)->whereUuid('mandate')->name('mandates.terminate');
        Route::post('/mandates/{mandate}/end-request/dismiss', DismissMandateEndRequestController::class)->whereUuid('mandate')->name('mandates.end-request.dismiss');
        Route::post('/mandates/{mandate}/renew', RenewMandateController::class)->whereUuid('mandate')->name('mandates.renew');
        Route::post('/mandates/{mandate}/terms', AmendMandateTermsController::class)->whereUuid('mandate')->name('mandates.terms.amend');
        Route::post('/mandates/{mandate}/archive', ArchiveMandateController::class)->whereUuid('mandate')->name('mandates.archive');
        Route::delete('/mandates/{mandate}/archive', RestoreMandateController::class)->whereUuid('mandate')->name('mandates.restore');
        Route::get('/mandates/{mandate}/documents', ListMandateDocumentsController::class)->whereUuid('mandate')->name('mandates.documents.index');
        Route::post('/mandates/{mandate}/documents', ShareMandateDocumentController::class)->whereUuid('mandate')->name('mandates.documents.store');
        Route::delete('/mandates/{mandate}/documents/{document}', UnshareMandateDocumentController::class)->whereUuid(['mandate', 'document'])->name('mandates.documents.destroy');
        Route::post('/mandates/{mandate}/units', AddMandateUnitController::class)->whereUuid('mandate')->name('mandates.units.store');
        Route::delete('/mandates/{mandate}/units/{mandateUnit}', RemoveMandateUnitController::class)->whereUuid(['mandate', 'mandateUnit'])->name('mandates.units.destroy');
        Route::post('/mandates/{mandate}/units/{mandateUnit}/end', EndMandateUnitController::class)->whereUuid(['mandate', 'mandateUnit'])->name('mandates.units.end');
    });
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'throttle:60,1,owner-reads'])->prefix('owner')->group(function (): void {
    Route::get('/agencies', ListOwnerAgenciesController::class)->name('mandates.owner.agencies.index');
    Route::get('/mandates', ListOwnerMandatesController::class)->name('mandates.owner.mandates.index');
    Route::get('/mandates/{mandate}', ShowOwnerMandateController::class)->whereUuid('mandate')->name('mandates.owner.mandates.show');
    Route::get('/properties', ListOwnerPropertiesController::class)->name('mandates.owner.properties.index');
    Route::get('/properties/{unit}', ShowOwnerPropertyController::class)->whereUuid('unit')->name('mandates.owner.properties.show');
    Route::get('/documents', ListOwnerDocumentsController::class)->name('mandates.owner.documents.index');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'throttle:30,1,owner-downloads'])->prefix('owner')->group(function (): void {
    Route::get('/documents/{document}/download', DownloadOwnerDocumentController::class)->whereUuid('document')->name('mandates.owner.documents.download');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'web-session', 'throttle:10,1,owner-mandate-end', 'two-factor', 'reauthenticated:two-factor'])->prefix('owner')->group(function (): void {
    Route::post('/mandates/{mandate}/end-request', StoreOwnerMandateEndRequestController::class)->whereUuid('mandate')->name('mandates.owner.end-request.store');
    Route::delete('/mandates/{mandate}/end-request', CancelOwnerMandateEndRequestController::class)->whereUuid('mandate')->name('mandates.owner.end-request.destroy');
});
