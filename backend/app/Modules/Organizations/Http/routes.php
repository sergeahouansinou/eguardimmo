<?php

declare(strict_types=1);

use App\Modules\Organizations\Http\Controllers\AcceptInvitationController;
use App\Modules\Organizations\Http\Controllers\CreateOrganizationController;
use App\Modules\Organizations\Http\Controllers\Organization\DeactivateMemberController;
use App\Modules\Organizations\Http\Controllers\Organization\InviteMemberController;
use App\Modules\Organizations\Http\Controllers\Organization\ListMembersController;
use App\Modules\Organizations\Http\Controllers\Organization\ReactivateMemberController;
use App\Modules\Organizations\Http\Controllers\Organization\RemoveMemberController;
use App\Modules\Organizations\Http\Controllers\Organization\ResendInvitationController;
use App\Modules\Organizations\Http\Controllers\Organization\ShowOrganizationController;
use App\Modules\Organizations\Http\Controllers\Organization\UpdateMemberController;
use App\Modules\Organizations\Http\Controllers\Organization\UpdateSecurityController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'no-operator-token', 'verified'])->group(function (): void {
    Route::post('/organizations', CreateOrganizationController::class)->middleware('throttle:6,1')->name('organizations.store');
    Route::post('/invitations/acceptance', AcceptInvitationController::class)->middleware('throttle:auth')->name('organizations.invitations.accept');
});

Route::middleware(['auth:sanctum', 'space:organization', 'organization'])->prefix('org/{organization}')->group(function (): void {
    Route::get('/', ShowOrganizationController::class)->name('organizations.show');
    Route::get('/members', ListMembersController::class)->name('organizations.members.index');
});

Route::middleware(['auth:sanctum', 'space:organization', 'organization:owner,admin'])->prefix('org/{organization}')->group(function (): void {
    Route::post('/members', InviteMemberController::class)->name('organizations.members.store');
    Route::patch('/members/{member}', UpdateMemberController::class)->whereUuid('member')->name('organizations.members.update');
    Route::delete('/members/{member}', RemoveMemberController::class)->whereUuid('member')->name('organizations.members.destroy');
    Route::post('/members/{member}/invitation', ResendInvitationController::class)->whereUuid('member')->name('organizations.members.invitation.resend');
    Route::post('/members/{member}/deactivation', DeactivateMemberController::class)->whereUuid('member')->name('organizations.members.deactivate');
    Route::delete('/members/{member}/deactivation', ReactivateMemberController::class)->whereUuid('member')->name('organizations.members.reactivate');
    Route::put('/security', UpdateSecurityController::class)->name('organizations.security.update');
});
