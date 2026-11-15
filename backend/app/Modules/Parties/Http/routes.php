<?php

declare(strict_types=1);

use App\Modules\Parties\Http\Controllers\Organization\AddBankAccountController;
use App\Modules\Parties\Http\Controllers\Organization\AddContactPointController;
use App\Modules\Parties\Http\Controllers\Organization\AddIdentifierController;
use App\Modules\Parties\Http\Controllers\Organization\AnonymizePartyController;
use App\Modules\Parties\Http\Controllers\Organization\ArchivePartyController;
use App\Modules\Parties\Http\Controllers\Organization\CreatePartyController;
use App\Modules\Parties\Http\Controllers\Organization\ListPartiesController;
use App\Modules\Parties\Http\Controllers\Organization\ReplaceBankAccountController;
use App\Modules\Parties\Http\Controllers\Organization\RestorePartyController;
use App\Modules\Parties\Http\Controllers\Organization\ShowPartyController;
use App\Modules\Parties\Http\Controllers\Organization\UpdateContactPointController;
use App\Modules\Parties\Http\Controllers\Organization\UpdateIdentifierController;
use App\Modules\Parties\Http\Controllers\Organization\UpdatePartyController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'space:organization'])->prefix('org/{organization}/parties')->group(function (): void {
    Route::middleware('organization')->group(function (): void {
        Route::get('/', ListPartiesController::class)->name('parties.index');
        Route::get('/{party}', ShowPartyController::class)->whereUuid('party')->name('parties.show');
    });

    Route::middleware(['organization:owner,admin,manager', 'throttle:60,1'])->group(function (): void {
        Route::post('/', CreatePartyController::class)->name('parties.store');
        Route::patch('/{party}', UpdatePartyController::class)->whereUuid('party')->name('parties.update');
        Route::post('/{party}/archive', ArchivePartyController::class)->whereUuid('party')->name('parties.archive');
        Route::delete('/{party}/archive', RestorePartyController::class)->whereUuid('party')->name('parties.restore');

        Route::post('/{party}/contact-points', AddContactPointController::class)->whereUuid('party')->name('parties.contact-points.store');
        Route::patch('/{party}/contact-points/{contactPoint}', UpdateContactPointController::class)->whereUuid(['party', 'contactPoint'])->name('parties.contact-points.update');

        Route::post('/{party}/identifiers', AddIdentifierController::class)->whereUuid('party')->name('parties.identifiers.store');
        Route::patch('/{party}/identifiers/{identifier}', UpdateIdentifierController::class)->whereUuid(['party', 'identifier'])->name('parties.identifiers.update');

        Route::post('/{party}/bank-accounts', AddBankAccountController::class)->whereUuid('party')->name('parties.bank-accounts.store');
        Route::post('/{party}/bank-accounts/{bankAccount}/replacement', ReplaceBankAccountController::class)->whereUuid(['party', 'bankAccount'])->name('parties.bank-accounts.replace');
    });

    Route::middleware(['organization:owner,admin', 'throttle:20,1'])->group(function (): void {
        Route::post('/{party}/anonymization', AnonymizePartyController::class)->whereUuid('party')->name('parties.anonymize');
    });
});
