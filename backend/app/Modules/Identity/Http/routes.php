<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Controllers\CancelEmailChangeController;
use App\Modules\Identity\Http\Controllers\CompleteMobileTwoFactorController;
use App\Modules\Identity\Http\Controllers\ConfirmEmailChangeController;
use App\Modules\Identity\Http\Controllers\Console\ListActivityController;
use App\Modules\Identity\Http\Controllers\Console\ListOperatorsController;
use App\Modules\Identity\Http\Controllers\Console\ReviewAccountSuspensionController;
use App\Modules\Identity\Http\Controllers\Console\RevokeAccountSessionsController;
use App\Modules\Identity\Http\Controllers\Console\SearchAccountsController;
use App\Modules\Identity\Http\Controllers\Console\ShowAccountController;
use App\Modules\Identity\Http\Controllers\Console\ShowActivityController;
use App\Modules\Identity\Http\Controllers\Console\SuspendAccountController;
use App\Modules\Identity\Http\Controllers\DeleteAccountController;
use App\Modules\Identity\Http\Controllers\IssueConsoleTokenController;
use App\Modules\Identity\Http\Controllers\IssueMobileTokenController;
use App\Modules\Identity\Http\Controllers\IssueSocialMobileTokenController;
use App\Modules\Identity\Http\Controllers\ListDevicesController;
use App\Modules\Identity\Http\Controllers\ListProfilesController;
use App\Modules\Identity\Http\Controllers\RequestEmailChangeController;
use App\Modules\Identity\Http\Controllers\ResendEmailVerificationController;
use App\Modules\Identity\Http\Controllers\RevokeCurrentTokenController;
use App\Modules\Identity\Http\Controllers\RevokeDeviceController;
use App\Modules\Identity\Http\Controllers\ShowConsoleMeController;
use App\Modules\Identity\Http\Controllers\ShowMeController;
use App\Modules\Identity\Http\Controllers\ShowPasswordResetStatusController;
use App\Modules\Identity\Http\Controllers\ShowSecurityController;
use App\Modules\Identity\Http\Controllers\UpdateMeController;
use App\Modules\Identity\Http\Controllers\UpdatePhoneController;
use App\Modules\Identity\Http\Controllers\VerifyEmailFromLinkController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'no-operator-token'])->group(function (): void {
    Route::get('/me', ShowMeController::class)->name('identity.me');
    Route::delete('/me', DeleteAccountController::class)->middleware('throttle:reauth')->name('identity.me.destroy');
    Route::patch('/me', UpdateMeController::class)->middleware('throttle:10,1,profile-update')->name('identity.me.update');
    Route::put('/me/phone', UpdatePhoneController::class)->middleware(['reauthenticated', 'throttle:10,60,phone-update'])->name('identity.phone.update');
    Route::middleware('web-session')->group(function (): void {
        Route::post('/me/email-change', RequestEmailChangeController::class)->middleware(['reauthenticated', 'throttle:3,60,email-change'])->name('identity.email-change.store');
        Route::delete('/me/email-change', CancelEmailChangeController::class)->middleware('throttle:10,60,email-change-cancel')->name('identity.email-change.destroy');
        Route::post('/me/email-change/confirmation', ConfirmEmailChangeController::class)->middleware('throttle:auth')->name('identity.email-change.confirm');
    });
    Route::get('/me/security', ShowSecurityController::class)->name('identity.security');
    Route::get('/me/profiles', ListProfilesController::class)->name('identity.profiles');
    Route::get('/me/devices', ListDevicesController::class)->name('identity.devices.index');
    Route::delete('/me/devices/{device}', RevokeDeviceController::class)->whereUuid('device')->name('identity.devices.destroy');
    Route::delete('/auth/token', RevokeCurrentTokenController::class)->name('identity.token.destroy');
});

Route::middleware('throttle:auth')->group(function (): void {
    Route::post('/auth/email/verify/{id}/{hash}', VerifyEmailFromLinkController::class)->name('identity.email.verify');
    Route::post('/auth/email/verification-notification', ResendEmailVerificationController::class)
        ->middleware('throttle:verification-resend')
        ->name('identity.email.resend');
    Route::post('/auth/password-reset/status', ShowPasswordResetStatusController::class)->name('identity.password-reset.status');
    Route::post('/auth/token', IssueMobileTokenController::class)->name('identity.token.store');
    Route::post('/auth/token/two-factor', CompleteMobileTwoFactorController::class)->name('identity.token.two-factor');
    Route::post('/auth/social/{provider}/token', IssueSocialMobileTokenController::class)
        ->whereIn('provider', ['google', 'apple'])
        ->name('identity.social.token');
    Route::post('/console/auth/token', IssueConsoleTokenController::class)->name('identity.console.token.store');
});

Route::middleware(['auth:sanctum', 'space:operator'])->prefix('console')->group(function (): void {
    Route::middleware(['operator:any', 'throttle:console-read'])->group(function (): void {
        Route::get('/me', ShowConsoleMeController::class)->name('identity.console.me');
    });
    Route::delete('/auth/token', RevokeCurrentTokenController::class)->middleware('operator:any')->name('identity.console.token.destroy');
    Route::middleware(['operator:admin,support,compliance', 'throttle:console-read'])->group(function (): void {
        Route::get('/activity', ListActivityController::class)->name('identity.console.activity.index');
        Route::get('/activity/{activity}', ShowActivityController::class)->whereUuid('activity')->name('identity.console.activity.show');
    });
    Route::get('/accounts', SearchAccountsController::class)->middleware(['operator:admin,support,compliance', 'throttle:console-account-search'])->name('identity.console.accounts.search');
    Route::get('/accounts/{user}', ShowAccountController::class)->whereUuid('user')->middleware(['operator:admin,support,compliance', 'throttle:console-read'])->name('identity.console.accounts.show');
    Route::middleware(['operator:admin,support', 'throttle:console-write', 'operator-proof'])->group(function (): void {
        Route::post('/accounts/{user}/session-revocation', RevokeAccountSessionsController::class)->whereUuid('user')->name('identity.console.accounts.session_revocation');
        Route::post('/accounts/{user}/suspension', SuspendAccountController::class)->whereUuid('user')->name('identity.console.accounts.suspension');
    });
    Route::post('/accounts/{user}/suspension/review', ReviewAccountSuspensionController::class)->whereUuid('user')->middleware(['operator:admin,compliance', 'throttle:console-write', 'operator-proof'])->name('identity.console.accounts.suspension_review');
    Route::get('/operators', ListOperatorsController::class)->middleware(['operator:admin', 'throttle:console-read'])->name('identity.console.operators.index');
});
