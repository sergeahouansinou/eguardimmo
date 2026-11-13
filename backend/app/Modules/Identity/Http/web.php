<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Controllers\HandleProviderCallbackController;
use App\Modules\Identity\Http\Controllers\LinkProviderController;
use App\Modules\Identity\Http\Controllers\ReauthenticateWithTwoFactorController;
use App\Modules\Identity\Http\Controllers\RedirectToProviderController;
use App\Modules\Identity\Http\Controllers\RegisterController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:auth')->group(function (): void {
    Route::post('/register', RegisterController::class)->middleware('guest:web')->name('identity.register');

    Route::post('/reauthenticate/two-factor', ReauthenticateWithTwoFactorController::class)
        ->middleware('auth:web')
        ->name('identity.reauthenticate.two-factor');

    Route::prefix('/social/{provider}')->whereIn('provider', ['google', 'apple'])->group(function (): void {
        Route::get('/redirect', RedirectToProviderController::class)->name('identity.social.redirect');
        Route::post('/link', LinkProviderController::class)
            ->middleware(['auth:web', 'verified', 'reauthenticated'])
            ->name('identity.social.link');
        Route::match(['get', 'post'], '/callback', HandleProviderCallbackController::class)->name('identity.social.callback');
    });
});
