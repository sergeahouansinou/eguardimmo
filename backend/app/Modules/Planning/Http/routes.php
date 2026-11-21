<?php

declare(strict_types=1);

use App\Modules\Planning\Http\Controllers\Organization\BulkAssignTasksController;
use App\Modules\Planning\Http\Controllers\Organization\BulkCompleteTasksController;
use App\Modules\Planning\Http\Controllers\Organization\BulkPostponeTasksController;
use App\Modules\Planning\Http\Controllers\Organization\CancelEventController;
use App\Modules\Planning\Http\Controllers\Organization\CancelTaskController;
use App\Modules\Planning\Http\Controllers\Organization\CompleteTaskController;
use App\Modules\Planning\Http\Controllers\Organization\CreateEventController;
use App\Modules\Planning\Http\Controllers\Organization\CreateTaskController;
use App\Modules\Planning\Http\Controllers\Organization\ListEventsController;
use App\Modules\Planning\Http\Controllers\Organization\ListTasksController;
use App\Modules\Planning\Http\Controllers\Organization\ReopenTaskController;
use App\Modules\Planning\Http\Controllers\Organization\ShowEventController;
use App\Modules\Planning\Http\Controllers\Organization\ShowTaskController;
use App\Modules\Planning\Http\Controllers\Organization\UpdateEventController;
use App\Modules\Planning\Http\Controllers\Organization\UpdateTaskController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'space:organization'])->prefix('org/{organization}/planning')->group(function (): void {
    Route::middleware(['organization', 'throttle:120,1,planning-read'])->group(function (): void {
        Route::get('/events', ListEventsController::class)->name('planning.events.index');
        Route::get('/events/{event}', ShowEventController::class)->whereUuid('event')->name('planning.events.show');
        Route::get('/tasks', ListTasksController::class)->name('planning.tasks.index');
        Route::get('/tasks/{task}', ShowTaskController::class)->whereUuid('task')->name('planning.tasks.show');
    });

    Route::middleware(['organization:owner,admin,manager', 'throttle:60,1,planning-write'])->group(function (): void {
        Route::post('/events', CreateEventController::class)->name('planning.events.store');
        Route::patch('/events/{event}', UpdateEventController::class)->whereUuid('event')->name('planning.events.update');
        Route::post('/events/{event}/cancel', CancelEventController::class)->whereUuid('event')->name('planning.events.cancel');

        Route::post('/tasks', CreateTaskController::class)->name('planning.tasks.store');
        Route::patch('/tasks/{task}', UpdateTaskController::class)->whereUuid('task')->name('planning.tasks.update');
        Route::post('/tasks/{task}/cancel', CancelTaskController::class)->whereUuid('task')->name('planning.tasks.cancel');

        Route::post('/tasks/bulk/complete', BulkCompleteTasksController::class)->name('planning.tasks.bulk.complete');
        Route::post('/tasks/bulk/postpone', BulkPostponeTasksController::class)->name('planning.tasks.bulk.postpone');
        Route::post('/tasks/bulk/assign', BulkAssignTasksController::class)->name('planning.tasks.bulk.assign');
    });

    Route::middleware(['organization', 'throttle:60,1,planning-write'])->group(function (): void {
        Route::post('/tasks/{task}/complete', CompleteTaskController::class)->whereUuid('task')->name('planning.tasks.complete');
        Route::post('/tasks/{task}/reopen', ReopenTaskController::class)->whereUuid('task')->name('planning.tasks.reopen');
    });
});
