<?php

declare(strict_types=1);

use App\Modules\Geography\Http\Controllers\SearchPlacesController;
use Illuminate\Support\Facades\Route;

Route::get('/marketplace/places', SearchPlacesController::class)->middleware('throttle:marketplace-places')->name('geography.places.index');
