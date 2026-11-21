<?php

declare(strict_types=1);

use App\Modules\Organizations\Http\Controllers\AcceptInvitationController;
use App\Modules\Organizations\Http\Controllers\Console\ListConsoleOrganizationsController;
use App\Modules\Organizations\Http\Controllers\Console\ShowConsoleOrganizationController;
use App\Modules\Organizations\Http\Controllers\CreateOrganizationController;
use App\Modules\Organizations\Http\Controllers\Organization\DeactivateMemberController;
use App\Modules\Organizations\Http\Controllers\Organization\ExportActivityController;
use App\Modules\Organizations\Http\Controllers\Organization\InviteMemberController;
use App\Modules\Organizations\Http\Controllers\Organization\ListActivityController;
use App\Modules\Organizations\Http\Controllers\Organization\ListMembersController;
use App\Modules\Organizations\Http\Controllers\Organization\ListRolesController;
use App\Modules\Organizations\Http\Controllers\Organization\ReactivateMemberController;
use App\Modules\Organizations\Http\Controllers\Organization\RemoveMemberController;
use App\Modules\Organizations\Http\Controllers\Organization\ResendInvitationController;
use App\Modules\Organizations\Http\Controllers\Organization\ShowActivityController;
use App\Modules\Organizations\Http\Controllers\Organization\ShowLegalIdentityController;
use App\Modules\Organizations\Http\Controllers\Organization\ShowOrganizationController;
use App\Modules\Organizations\Http\Controllers\Organization\UpdateLegalIdentityController;
use App\Modules\Organizations\Http\Controllers\Organization\UpdateMemberController;
use App\Modules\Organizations\Http\Controllers\Organization\UpdateOrganizationController;
use App\Modules\Organizations\Http\Controllers\Organization\UpdateSecurityController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'no-operator-token', 'verified'])->group(function (): void {
    Route::post('/organizations', CreateOrganizationController::class)->middleware('throttle:6,1')->name('organizations.store');
    Route::post('/invitations/acceptance', AcceptInvitationController::class)->middleware('throttle:auth')->name('organizations.invitations.accept');
});

Route::middleware(['auth:sanctum', 'space:organization', 'organization'])->prefix('org/{organization}')->group(function (): void {
    Route::get('/', ShowOrganizationController::class)->name('organizations.show');
    Route::get('/members', ListMembersController::class)->name('organizations.members.index');
    Route::get('/roles', ListRolesController::class)->middleware('throttle:60,1,org-roles')->name('organizations.roles.index');
    Route::get('/legal-identity', ShowLegalIdentityController::class)->name('organizations.legal-identity.show');
});

Route::middleware(['auth:sanctum', 'space:organization', 'organization:owner,admin'])->prefix('org/{organization}')->group(function (): void {
    Route::post('/members', InviteMemberController::class)->name('organizations.members.store');
    Route::patch('/members/{member}', UpdateMemberController::class)->whereUuid('member')->name('organizations.members.update');
    Route::delete('/members/{member}', RemoveMemberController::class)->whereUuid('member')->name('organizations.members.destroy');
    Route::post('/members/{member}/invitation', ResendInvitationController::class)->whereUuid('member')->name('organizations.members.invitation.resend');
    Route::post('/members/{member}/deactivation', DeactivateMemberController::class)->whereUuid('member')->name('organizations.members.deactivate');
    Route::delete('/members/{member}/deactivation', ReactivateMemberController::class)->whereUuid('member')->name('organizations.members.reactivate');
    Route::patch('/', UpdateOrganizationController::class)->middleware('throttle:30,1,org-update')->name('organizations.update');
    Route::put('/security', UpdateSecurityController::class)->name('organizations.security.update');
    Route::put('/legal-identity', UpdateLegalIdentityController::class)->middleware('throttle:30,1')->name('organizations.legal-identity.update');
});

Route::middleware(['auth:sanctum', 'space:organization', 'organization:owner,admin,manager', 'throttle:60,1,org-activity'])->prefix('org/{organization}')->group(function (): void {
    Route::get('/activity', ListActivityController::class)->name('organizations.activity.index');
});

Route::middleware(['auth:sanctum', 'space:organization', 'organization:owner,admin', 'two-factor', 'reauthenticated', 'throttle:5,60,org-activity-export'])->prefix('org/{organization}')->group(function (): void {
    Route::get('/activity/export', ExportActivityController::class)->name('organizations.activity.export');
});

Route::middleware(['auth:sanctum', 'space:organization', 'organization:owner,admin', 'throttle:60,1,org-activity'])->prefix('org/{organization}')->group(function (): void {
    Route::get('/activity/{activity}', ShowActivityController::class)->whereUuid('activity')->name('organizations.activity.show');
});

Route::middleware(['auth:sanctum', 'space:operator', 'operator:admin,support,compliance,billing', 'throttle:console-read'])->prefix('console/organizations')->group(function (): void {
    Route::get('/', ListConsoleOrganizationsController::class)->name('organizations.console.index');
    Route::get('/{organization}', ShowConsoleOrganizationController::class)->whereUuid('organization')->name('organizations.console.show');
});
