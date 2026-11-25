<?php

declare(strict_types=1);

use App\Modules\Listings\Http\Controllers\Marketplace\AddFavoriteController;
use App\Modules\Listings\Http\Controllers\Marketplace\ListFavoritesController;
use App\Modules\Listings\Http\Controllers\Marketplace\RemoveFavoriteController;
use App\Modules\Listings\Http\Controllers\Marketplace\SearchListingsController;
use App\Modules\Listings\Http\Controllers\Marketplace\ShowFavoriteController;
use App\Modules\Listings\Http\Controllers\Marketplace\ShowPublicListingController;
use App\Modules\Listings\Http\Controllers\Marketplace\StoreVisitRequestController;
use App\Modules\Listings\Http\Controllers\Organization\ArchiveListingController;
use App\Modules\Listings\Http\Controllers\Organization\ListListingsController;
use App\Modules\Listings\Http\Controllers\Organization\PublishListingController;
use App\Modules\Listings\Http\Controllers\Organization\ShowListingController;
use App\Modules\Listings\Http\Controllers\Organization\StoreListingController;
use App\Modules\Listings\Http\Controllers\Organization\UpdateListingController;
use Illuminate\Support\Facades\Route;

$ref = '[a-z2-9]{12}';

Route::prefix('marketplace')->group(function () use ($ref): void {
    Route::middleware('throttle:marketplace-listings')->group(function () use ($ref): void {
        Route::get('/listings', SearchListingsController::class)->name('listings.index');
        Route::get('/listings/{ref}', ShowPublicListingController::class)->where('ref', $ref)->name('listings.show');
    });

    Route::middleware(['auth:sanctum', 'no-operator-token', 'marketplace.traveler'])->group(function () use ($ref): void {
        Route::middleware('throttle:marketplace-favorites')->group(function () use ($ref): void {
            Route::get('/favorites', ListFavoritesController::class)->name('listings.favorites.index');
            Route::get('/favorites/{ref}', ShowFavoriteController::class)->where('ref', $ref)->name('listings.favorites.show');
            Route::put('/favorites/{ref}', AddFavoriteController::class)->where('ref', $ref)->name('listings.favorites.store');
            Route::delete('/favorites/{ref}', RemoveFavoriteController::class)->where('ref', $ref)->name('listings.favorites.destroy');
        });

        Route::post('/listings/{ref}/visit-requests', StoreVisitRequestController::class)->where('ref', $ref)->middleware('throttle:marketplace-visit-requests')->name('listings.visit-requests.store');
    });
});

Route::middleware(['auth:sanctum', 'space:organization', 'organization:owner,admin,manager', 'throttle:120,1,listings-org'])->prefix('org/{organization}/listings')->group(function (): void {
    Route::get('/', ListListingsController::class)->name('listings.organization.index');
    Route::post('/', StoreListingController::class)->name('listings.organization.store');
    Route::get('/{listing}', ShowListingController::class)->whereUuid('listing')->name('listings.organization.show');
    Route::patch('/{listing}', UpdateListingController::class)->whereUuid('listing')->name('listings.organization.update');
    Route::post('/{listing}/publish', PublishListingController::class)->whereUuid('listing')->name('listings.organization.publish');
    Route::post('/{listing}/archive', ArchiveListingController::class)->whereUuid('listing')->name('listings.organization.archive');
});
