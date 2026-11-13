<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Controllers\ShowMeController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->get('/me', ShowMeController::class)->name('identity.me');
