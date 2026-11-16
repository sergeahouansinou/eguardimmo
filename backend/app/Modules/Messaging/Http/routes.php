<?php

declare(strict_types=1);

use App\Modules\Messaging\Http\Controllers\Console\DownloadAttachmentController;
use App\Modules\Messaging\Http\Controllers\Console\GrantAccessController;
use App\Modules\Messaging\Http\Controllers\Console\ListStaffController;
use App\Modules\Messaging\Http\Controllers\Console\ListTicketsController;
use App\Modules\Messaging\Http\Controllers\Console\ReplyTicketController;
use App\Modules\Messaging\Http\Controllers\Console\ShowTicketController;
use App\Modules\Messaging\Http\Controllers\Console\TicketStatsController;
use App\Modules\Messaging\Http\Controllers\Console\UpdateTicketController;
use App\Modules\Messaging\Http\Controllers\DownloadMyAttachmentController;
use App\Modules\Messaging\Http\Controllers\ListMyTicketsController;
use App\Modules\Messaging\Http\Controllers\OpenTicketController;
use App\Modules\Messaging\Http\Controllers\Organization\ConversationStatsController;
use App\Modules\Messaging\Http\Controllers\Organization\DownloadConversationAttachmentController;
use App\Modules\Messaging\Http\Controllers\Organization\ListConversationsController;
use App\Modules\Messaging\Http\Controllers\Organization\ListRecipientsController;
use App\Modules\Messaging\Http\Controllers\Organization\ReplyConversationController;
use App\Modules\Messaging\Http\Controllers\Organization\ShowConversationController;
use App\Modules\Messaging\Http\Controllers\Organization\StartConversationController;
use App\Modules\Messaging\Http\Controllers\Organization\UpdateConversationStateController;
use App\Modules\Messaging\Http\Controllers\ReplyMyTicketController;
use App\Modules\Messaging\Http\Controllers\ShowMyTicketController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'no-operator-token', 'verified'])->prefix('support')->group(function (): void {
    Route::get('/tickets', ListMyTicketsController::class)->name('messaging.support.tickets.index');
    Route::post('/tickets', OpenTicketController::class)->middleware('throttle:10,1')->name('messaging.support.tickets.store');
    Route::get('/tickets/{ticket}', ShowMyTicketController::class)->whereUuid('ticket')->name('messaging.support.tickets.show');
    Route::post('/tickets/{ticket}/messages', ReplyMyTicketController::class)->whereUuid('ticket')->middleware('throttle:30,1')->name('messaging.support.tickets.reply');
    Route::get('/attachments/{attachment}', DownloadMyAttachmentController::class)->whereUuid('attachment')->name('messaging.support.attachments.show');
});

Route::middleware(['auth:sanctum', 'space:operator'])->prefix('console/support')->group(function (): void {
    Route::get('/tickets', ListTicketsController::class)->name('messaging.console.tickets.index');
    Route::get('/stats', TicketStatsController::class)->name('messaging.console.tickets.stats');
    Route::get('/staff', ListStaffController::class)->name('messaging.console.staff.index');
    Route::get('/tickets/{ticket}', ShowTicketController::class)->whereUuid('ticket')->name('messaging.console.tickets.show');
    Route::patch('/tickets/{ticket}', UpdateTicketController::class)->whereUuid('ticket')->name('messaging.console.tickets.update');
    Route::post('/tickets/{ticket}/messages', ReplyTicketController::class)->whereUuid('ticket')->name('messaging.console.tickets.reply');
    Route::post('/tickets/{ticket}/access', GrantAccessController::class)->whereUuid('ticket')->name('messaging.console.tickets.access');
    Route::get('/attachments/{attachment}', DownloadAttachmentController::class)->whereUuid('attachment')->name('messaging.console.attachments.show');
});

Route::middleware(['auth:sanctum', 'space:organization', 'organization'])->prefix('org/{organization}')->group(function (): void {
    Route::get('/conversations', ListConversationsController::class)->name('messaging.conversations.index');
    Route::post('/conversations', StartConversationController::class)->middleware('throttle:30,1')->name('messaging.conversations.store');
    Route::get('/conversations/stats', ConversationStatsController::class)->name('messaging.conversations.stats');
    Route::get('/conversations/recipients', ListRecipientsController::class)->name('messaging.conversations.recipients');
    Route::get('/conversations/{conversation}', ShowConversationController::class)->whereUuid('conversation')->name('messaging.conversations.show');
    Route::post('/conversations/{conversation}/messages', ReplyConversationController::class)->whereUuid('conversation')->middleware('throttle:60,1')->name('messaging.conversations.reply');
    Route::patch('/conversations/{conversation}', UpdateConversationStateController::class)->whereUuid('conversation')->name('messaging.conversations.update');
    Route::get('/conversation-attachments/{attachment}', DownloadConversationAttachmentController::class)->whereUuid('attachment')->name('messaging.conversations.attachments.show');
});
