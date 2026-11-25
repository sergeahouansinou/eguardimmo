<?php

declare(strict_types=1);

use App\Modules\Bookings\Http\Controllers\Marketplace\CancelBookingController;
use App\Modules\Bookings\Http\Controllers\Marketplace\ListBookingsController;
use App\Modules\Bookings\Http\Controllers\Marketplace\QuoteStayController;
use App\Modules\Bookings\Http\Controllers\Marketplace\ShowAvailabilityController;
use App\Modules\Bookings\Http\Controllers\Marketplace\ShowBookingController;
use App\Modules\Bookings\Http\Controllers\Marketplace\StoreBookingController;
use App\Modules\Bookings\Http\Controllers\Organization\ListOrganizationBookingsController;
use Illuminate\Support\Facades\Route;

$ref = '[a-z2-9]{12}';

Route::prefix('marketplace')->group(function () use ($ref): void {
    Route::get('/listings/{ref}/availability', ShowAvailabilityController::class)->where('ref', $ref)->middleware('throttle:marketplace-availability')->name('bookings.availability.show');
    Route::post('/listings/{ref}/quote', QuoteStayController::class)->where('ref', $ref)->middleware('throttle:marketplace-quote')->name('bookings.quote.store');

    Route::middleware(['auth:sanctum', 'no-operator-token', 'marketplace.traveler', 'throttle:60,1,marketplace-bookings'])->group(function (): void {
        Route::post('/bookings', StoreBookingController::class)->middleware('throttle:marketplace-bookings-create')->name('bookings.store');
        Route::get('/bookings', ListBookingsController::class)->name('bookings.index');
        Route::get('/bookings/{booking}', ShowBookingController::class)->whereUuid('booking')->name('bookings.show');
        Route::post('/bookings/{booking}/cancel', CancelBookingController::class)->whereUuid('booking')->name('bookings.cancel');
    });
});

Route::middleware(['auth:sanctum', 'space:organization', 'organization:owner,admin,manager', 'throttle:120,1,bookings-org'])->prefix('org/{organization}/bookings')->group(function (): void {
    Route::get('/', ListOrganizationBookingsController::class)->name('bookings.organization.index');
});
