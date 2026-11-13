<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Controllers\CompleteMobileTwoFactorController;
use App\Modules\Identity\Http\Controllers\Console\ListActivityController;
use App\Modules\Identity\Http\Controllers\Console\ShowActivityController;
use App\Modules\Identity\Http\Controllers\IssueConsoleTokenController;
use App\Modules\Identity\Http\Controllers\IssueMobileTokenController;
use App\Modules\Identity\Http\Controllers\IssueSocialMobileTokenController;
use App\Modules\Identity\Http\Controllers\ListDevicesController;
use App\Modules\Identity\Http\Controllers\ListProfilesController;
use App\Modules\Identity\Http\Controllers\RevokeCurrentTokenController;
use App\Modules\Identity\Http\Controllers\RevokeDeviceController;
use App\Modules\Identity\Http\Controllers\ShowConsoleMeController;
use App\Modules\Identity\Http\Controllers\ShowMeController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/me', ShowMeController::class)->name('identity.me');
    Route::get('/me/profiles', ListProfilesController::class)->name('identity.profiles');
    Route::get('/me/devices', ListDevicesController::class)->name('identity.devices.index');
    Route::delete('/me/devices/{device}', RevokeDeviceController::class)->whereUuid('device')->name('identity.devices.destroy');
    Route::delete('/auth/token', RevokeCurrentTokenController::class)->name('identity.token.destroy');
});

Route::middleware('throttle:auth')->group(function (): void {
    Route::post('/auth/token', IssueMobileTokenController::class)->name('identity.token.store');
    Route::post('/auth/token/two-factor', CompleteMobileTwoFactorController::class)->name('identity.token.two-factor');
    Route::post('/auth/social/{provider}/token', IssueSocialMobileTokenController::class)
        ->whereIn('provider', ['google', 'apple'])
        ->name('identity.social.token');
    Route::post('/console/auth/token', IssueConsoleTokenController::class)->name('identity.console.token.store');
});

Route::middleware(['auth:sanctum', 'space:operator'])->prefix('console')->group(function (): void {
    Route::get('/me', ShowConsoleMeController::class)->name('identity.console.me');
    Route::get('/activity', ListActivityController::class)->name('identity.console.activity.index');
    Route::get('/activity/{activity}', ShowActivityController::class)->whereUuid('activity')->name('identity.console.activity.show');
    Route::delete('/auth/token', RevokeCurrentTokenController::class)->name('identity.console.token.destroy');
});
