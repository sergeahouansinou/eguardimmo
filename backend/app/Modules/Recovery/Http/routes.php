<?php

declare(strict_types=1);

use App\Modules\Recovery\Http\Controllers\Guest\DownloadByTokenController;
use App\Modules\Recovery\Http\Controllers\Organization\AddActController;
use App\Modules\Recovery\Http\Controllers\Organization\AddItemsController;
use App\Modules\Recovery\Http\Controllers\Organization\ChangeStatusController;
use App\Modules\Recovery\Http\Controllers\Organization\DownloadBundleController;
use App\Modules\Recovery\Http\Controllers\Organization\GenerateBundleController;
use App\Modules\Recovery\Http\Controllers\Organization\ListActsController;
use App\Modules\Recovery\Http\Controllers\Organization\ListCasesController;
use App\Modules\Recovery\Http\Controllers\Organization\ListUnpaidController;
use App\Modules\Recovery\Http\Controllers\Organization\OpenCaseController;
use App\Modules\Recovery\Http\Controllers\Organization\RemoveItemController;
use App\Modules\Recovery\Http\Controllers\Organization\ResendTransmissionController;
use App\Modules\Recovery\Http\Controllers\Organization\RevokeTransmissionController;
use App\Modules\Recovery\Http\Controllers\Organization\ShowBundleController;
use App\Modules\Recovery\Http\Controllers\Organization\ShowCaseController;
use App\Modules\Recovery\Http\Controllers\Organization\TransmitBundleController;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

Route::middleware(['auth:sanctum', 'space:organization'])->prefix('org/{organization}/recovery')->group(function (): void {
    Route::middleware(['organization:owner,admin,manager,accountant', 'entitled:recovery', 'throttle:120,1,recovery-lecture'])->group(function (): void {
        Route::get('/unpaid', ListUnpaidController::class)->name('recovery.unpaid.index');
        Route::get('/cases', ListCasesController::class)->name('recovery.cases.index');
        Route::get('/cases/{case}', ShowCaseController::class)->whereUuid('case')->name('recovery.cases.show');
        Route::get('/cases/{case}/acts', ListActsController::class)->whereUuid('case')->name('recovery.cases.acts.index');
        Route::get('/bundles/{bundle}', ShowBundleController::class)->whereUuid('bundle')->name('recovery.bundles.show');
        Route::get('/bundles/{bundle}/download', DownloadBundleController::class)->whereUuid('bundle')->name('recovery.bundles.download');
    });

    Route::middleware(['organization:owner,admin,manager', 'entitled:recovery', 'throttle:60,1'])->group(function (): void {
        Route::post('/cases', OpenCaseController::class)->name('recovery.cases.store');
        Route::post('/cases/{case}/items', AddItemsController::class)->whereUuid('case')->name('recovery.cases.items.store');
        Route::delete('/cases/{case}/items/{item}', RemoveItemController::class)->whereUuid(['case', 'item'])->name('recovery.cases.items.destroy');
        Route::post('/cases/{case}/status', ChangeStatusController::class)->whereUuid('case')->name('recovery.cases.status');
        Route::post('/cases/{case}/acts', AddActController::class)->whereUuid('case')->name('recovery.cases.acts.store');
        Route::post('/cases/{case}/bundles', GenerateBundleController::class)->whereUuid('case')->middleware('throttle:recovery-generation')->name('recovery.cases.bundles.store');
        Route::post('/bundles/{bundle}/transmissions', TransmitBundleController::class)->whereUuid('bundle')->name('recovery.bundles.transmissions.store');
        Route::post('/transmissions/{transmission}/revoke', RevokeTransmissionController::class)->whereUuid('transmission')->name('recovery.transmissions.revoke');
        Route::post('/transmissions/{transmission}/resend', ResendTransmissionController::class)->whereUuid('transmission')->name('recovery.transmissions.resend');
    });
});

// Lien du commissaire de justice : aucune session ni cookie (le jeton fait foi), même 404 pour tout lien invalide.
Route::get('/recovery/downloads/{token}', DownloadByTokenController::class)
    ->middleware('throttle:recovery-download')
    ->withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
    ->name('recovery.downloads.show');
