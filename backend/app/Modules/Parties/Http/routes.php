<?php

declare(strict_types=1);

use App\Modules\Parties\Http\Controllers\AcceptOwnerInvitationController;
use App\Modules\Parties\Http\Controllers\AcceptTenantInvitationController;
use App\Modules\Parties\Http\Controllers\Organization\AddBankAccountController;
use App\Modules\Parties\Http\Controllers\Organization\AddContactPointController;
use App\Modules\Parties\Http\Controllers\Organization\AddIdentifierController;
use App\Modules\Parties\Http\Controllers\Organization\AnonymizePartyController;
use App\Modules\Parties\Http\Controllers\Organization\ApplyContactUpdateController;
use App\Modules\Parties\Http\Controllers\Organization\ArchivePartyController;
use App\Modules\Parties\Http\Controllers\Organization\CreatePartyController;
use App\Modules\Parties\Http\Controllers\Organization\DismissContactUpdateController;
use App\Modules\Parties\Http\Controllers\Organization\ImportPartiesController;
use App\Modules\Parties\Http\Controllers\Organization\InviteOwnerAccessController;
use App\Modules\Parties\Http\Controllers\Organization\InviteTenantAccountController;
use App\Modules\Parties\Http\Controllers\Organization\ListContactUpdatesController;
use App\Modules\Parties\Http\Controllers\Organization\ListPartiesController;
use App\Modules\Parties\Http\Controllers\Organization\ReplaceBankAccountController;
use App\Modules\Parties\Http\Controllers\Organization\RestorePartyController;
use App\Modules\Parties\Http\Controllers\Organization\RevokeOwnerAccessController;
use App\Modules\Parties\Http\Controllers\Organization\RevokeTenantAccessController;
use App\Modules\Parties\Http\Controllers\Organization\ShowOwnerAccessController;
use App\Modules\Parties\Http\Controllers\Organization\ShowPartyController;
use App\Modules\Parties\Http\Controllers\Organization\ShowTenantAccessController;
use App\Modules\Parties\Http\Controllers\Organization\UpdateContactPointController;
use App\Modules\Parties\Http\Controllers\Organization\UpdateIdentifierController;
use App\Modules\Parties\Http\Controllers\Organization\UpdatePartyController;
use App\Modules\Parties\Http\Controllers\Owner\ListOwnerLinksController;
use App\Modules\Parties\Http\Controllers\Owner\RevokeOwnerLinkController;
use App\Modules\Parties\Http\Controllers\PreviewOwnerInvitationController;
use App\Modules\Parties\Http\Controllers\PreviewTenantInvitationController;
use App\Modules\Parties\Http\Controllers\Tenant\ListTenantContactUpdatesController;
use App\Modules\Parties\Http\Controllers\Tenant\ListTenantLinksController;
use App\Modules\Parties\Http\Controllers\Tenant\RevokeTenantLinkController;
use App\Modules\Parties\Http\Controllers\Tenant\StoreTenantContactUpdateController;
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

        Route::get('/{party}/contact-updates', ListContactUpdatesController::class)->whereUuid('party')->name('parties.contact-updates.index');
        Route::post('/{party}/contact-updates/{contactUpdate}/apply', ApplyContactUpdateController::class)->whereUuid(['party', 'contactUpdate'])->name('parties.contact-updates.apply');
        Route::post('/{party}/contact-updates/{contactUpdate}/dismiss', DismissContactUpdateController::class)->whereUuid(['party', 'contactUpdate'])->name('parties.contact-updates.dismiss');

        Route::post('/{party}/identifiers', AddIdentifierController::class)->whereUuid('party')->name('parties.identifiers.store');
        Route::patch('/{party}/identifiers/{identifier}', UpdateIdentifierController::class)->whereUuid(['party', 'identifier'])->name('parties.identifiers.update');
    });

    Route::middleware(['organization:owner,admin,manager', 'throttle:5,60,parties-import'])->group(function (): void {
        Route::post('/import', ImportPartiesController::class)->name('parties.import');
    });

    Route::middleware(['organization:owner,admin,manager', 'two-factor', 'reauthenticated:two-factor', 'throttle:20,1,parties-bank-accounts'])->group(function (): void {
        Route::post('/{party}/bank-accounts', AddBankAccountController::class)->whereUuid('party')->name('parties.bank-accounts.store');
        Route::post('/{party}/bank-accounts/{bankAccount}/replacement', ReplaceBankAccountController::class)->whereUuid(['party', 'bankAccount'])->name('parties.bank-accounts.replace');
    });

    Route::middleware(['organization:owner,admin,manager', 'throttle:20,1'])->group(function (): void {
        Route::get('/{party}/tenant-access', ShowTenantAccessController::class)->whereUuid('party')->name('parties.tenant-access.show');
        Route::post('/{party}/tenant-access', InviteTenantAccountController::class)->whereUuid('party')->name('parties.tenant-access.store');
        Route::delete('/{party}/tenant-access', RevokeTenantAccessController::class)->whereUuid('party')->name('parties.tenant-access.destroy');

        Route::get('/{party}/owner-access', ShowOwnerAccessController::class)->whereUuid('party')->name('parties.owner-access.show');
        Route::post('/{party}/owner-access', InviteOwnerAccessController::class)->whereUuid('party')->middleware(['two-factor', 'reauthenticated:two-factor'])->name('parties.owner-access.store');
        Route::delete('/{party}/owner-access/{access}', RevokeOwnerAccessController::class)->whereUuid(['party', 'access'])->name('parties.owner-access.destroy');
    });

    Route::middleware(['organization:owner,admin', 'throttle:20,1'])->group(function (): void {
        Route::post('/{party}/anonymization', AnonymizePartyController::class)->whereUuid('party')->name('parties.anonymize');
    });
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'verified', 'throttle:auth'])->prefix('tenant-invitations')->group(function (): void {
    Route::post('/preview', PreviewTenantInvitationController::class)->name('parties.tenant-invitations.preview');
    Route::post('/acceptance', AcceptTenantInvitationController::class)->name('parties.tenant-invitations.accept');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:tenant', 'verified', 'throttle:30,1,tenant-links'])->prefix('tenant/links')->group(function (): void {
    Route::get('/', ListTenantLinksController::class)->name('parties.tenant.links.index');
    Route::delete('/{party}', RevokeTenantLinkController::class)->whereUuid('party')->name('parties.tenant.links.destroy');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:tenant', 'verified', 'parties.private'])->prefix('tenant/contact-updates')->group(function (): void {
    Route::get('/', ListTenantContactUpdatesController::class)->middleware('throttle:30,1,tenant-contact-updates-read')->name('parties.tenant.contact-updates.index');
    Route::post('/', StoreTenantContactUpdateController::class)->middleware('throttle:5,1440,tenant-contact-updates')->name('parties.tenant.contact-updates.store');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'verified', 'parties.private-invitation', 'throttle:auth', 'throttle:owner-invitation'])->prefix('owner-invitations')->group(function (): void {
    Route::post('/preview', PreviewOwnerInvitationController::class)->name('parties.owner-invitations.preview');
    Route::post('/acceptance', AcceptOwnerInvitationController::class)->name('parties.owner-invitations.accept');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'throttle:30,1,owner-links'])->prefix('owner/links')->group(function (): void {
    Route::get('/', ListOwnerLinksController::class)->name('parties.owner.links.index');
    Route::delete('/{access}', RevokeOwnerLinkController::class)->whereUuid('access')->middleware('web-session')->name('parties.owner.links.destroy');
});
