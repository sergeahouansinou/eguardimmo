<?php

declare(strict_types=1);

use App\Modules\Documents\Http\Controllers\Organization\ArchiveLibraryDocumentController;
use App\Modules\Documents\Http\Controllers\Organization\CreateCertificateController;
use App\Modules\Documents\Http\Controllers\Organization\DownloadFileController;
use App\Modules\Documents\Http\Controllers\Organization\FileLibraryDocumentController;
use App\Modules\Documents\Http\Controllers\Organization\ListCertificatesController;
use App\Modules\Documents\Http\Controllers\Organization\ListLibraryController;
use App\Modules\Documents\Http\Controllers\Organization\RenewCertificateController;
use App\Modules\Documents\Http\Controllers\Organization\RestoreLibraryDocumentController;
use App\Modules\Documents\Http\Controllers\Organization\ShowCertificateController;
use App\Modules\Documents\Http\Controllers\Organization\UploadFileController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'space:organization'])->prefix('org/{organization}/documents')->group(function (): void {
    Route::middleware(['organization', 'entitled:documents', 'throttle:60,1'])->group(function (): void {
        Route::get('/files/{file}/download', DownloadFileController::class)->whereUuid('file')->name('documents.files.download');
        Route::get('/certificates', ListCertificatesController::class)->name('documents.certificates.index');
        Route::get('/certificates/{certificate}', ShowCertificateController::class)->whereUuid('certificate')->name('documents.certificates.show');
    });

    Route::middleware(['organization', 'entitled:documents', 'throttle:120,1,documents-library-lecture'])->group(function (): void {
        Route::get('/library', ListLibraryController::class)->name('documents.library.index');
    });

    Route::middleware(['organization:owner,admin,manager', 'entitled:documents', 'throttle:30,1,documents-library-ecriture'])->group(function (): void {
        Route::post('/library', FileLibraryDocumentController::class)->name('documents.library.store');
        Route::post('/library/{entry}/archive', ArchiveLibraryDocumentController::class)->whereUuid('entry')->name('documents.library.archive');
        Route::delete('/library/{entry}/archive', RestoreLibraryDocumentController::class)->whereUuid('entry')->name('documents.library.restore');
    });

    Route::middleware(['organization:owner,admin,manager', 'entitled:documents', 'throttle:60,1'])->group(function (): void {
        Route::post('/files', UploadFileController::class)->name('documents.files.store');
        Route::post('/certificates', CreateCertificateController::class)->name('documents.certificates.store');
        Route::post('/certificates/{certificate}/renew', RenewCertificateController::class)->whereUuid('certificate')->name('documents.certificates.renew');
    });
});
