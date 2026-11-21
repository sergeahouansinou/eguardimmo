<?php

declare(strict_types=1);

use App\Modules\Messaging\Http\Controllers\Console\DownloadAttachmentController;
use App\Modules\Messaging\Http\Controllers\Console\ListOrganizationSupportAccessesController;
use App\Modules\Messaging\Http\Controllers\Console\ListStaffController;
use App\Modules\Messaging\Http\Controllers\Console\ListTicketMessagesController;
use App\Modules\Messaging\Http\Controllers\Console\ListTicketsController;
use App\Modules\Messaging\Http\Controllers\Console\OpenEmergencyAccessController;
use App\Modules\Messaging\Http\Controllers\Console\OrganizationSettingsController;
use App\Modules\Messaging\Http\Controllers\Console\OrganizationTeamController;
use App\Modules\Messaging\Http\Controllers\Console\ReplyTicketController;
use App\Modules\Messaging\Http\Controllers\Console\RequestAccessController;
use App\Modules\Messaging\Http\Controllers\Console\ReviewAccessController;
use App\Modules\Messaging\Http\Controllers\Console\ShowTicketController;
use App\Modules\Messaging\Http\Controllers\Console\TicketStatsController;
use App\Modules\Messaging\Http\Controllers\Console\UpdateTicketController;
use App\Modules\Messaging\Http\Controllers\DownloadMyAttachmentController;
use App\Modules\Messaging\Http\Controllers\ListMyTicketMessagesController;
use App\Modules\Messaging\Http\Controllers\ListMyTicketsController;
use App\Modules\Messaging\Http\Controllers\OpenTicketController;
use App\Modules\Messaging\Http\Controllers\Organization\AcceptSupportAccessController;
use App\Modules\Messaging\Http\Controllers\Organization\ConversationStatsController;
use App\Modules\Messaging\Http\Controllers\Organization\DownloadConversationAttachmentController;
use App\Modules\Messaging\Http\Controllers\Organization\ListConversationMessagesController;
use App\Modules\Messaging\Http\Controllers\Organization\ListConversationsController;
use App\Modules\Messaging\Http\Controllers\Organization\ListRecipientsController;
use App\Modules\Messaging\Http\Controllers\Organization\ListSupportAccessController;
use App\Modules\Messaging\Http\Controllers\Organization\MuteCounterpartController;
use App\Modules\Messaging\Http\Controllers\Organization\RedactConversationMessageController;
use App\Modules\Messaging\Http\Controllers\Organization\RefuseSupportAccessController;
use App\Modules\Messaging\Http\Controllers\Organization\ReplyConversationController;
use App\Modules\Messaging\Http\Controllers\Organization\RevokeSupportAccessController;
use App\Modules\Messaging\Http\Controllers\Organization\ShowConversationController;
use App\Modules\Messaging\Http\Controllers\Organization\StartConversationController;
use App\Modules\Messaging\Http\Controllers\Organization\UnmuteCounterpartController;
use App\Modules\Messaging\Http\Controllers\Organization\UnreadConversationsController;
use App\Modules\Messaging\Http\Controllers\Organization\UpdateConversationStateController;
use App\Modules\Messaging\Http\Controllers\Owner\DownloadOwnerConversationAttachmentController;
use App\Modules\Messaging\Http\Controllers\Owner\ListOwnerConversationOptionsController;
use App\Modules\Messaging\Http\Controllers\Owner\ListOwnerConversationsController;
use App\Modules\Messaging\Http\Controllers\Owner\ListOwnerMessagesController;
use App\Modules\Messaging\Http\Controllers\Owner\OwnerUnreadConversationsController;
use App\Modules\Messaging\Http\Controllers\Owner\PostOwnerMessageController;
use App\Modules\Messaging\Http\Controllers\Owner\RedactOwnerMessageController;
use App\Modules\Messaging\Http\Controllers\Owner\ShowOwnerConversationController;
use App\Modules\Messaging\Http\Controllers\Owner\StartOwnerConversationController;
use App\Modules\Messaging\Http\Controllers\Owner\UpdateOwnerConversationController;
use App\Modules\Messaging\Http\Controllers\ReplyMyTicketController;
use App\Modules\Messaging\Http\Controllers\ShowMyTicketController;
use App\Modules\Messaging\Http\Controllers\SupportStatusController;
use App\Modules\Messaging\Http\Controllers\Tenant\DownloadTenantConversationAttachmentController;
use App\Modules\Messaging\Http\Controllers\Tenant\ListTenantConversationOptionsController;
use App\Modules\Messaging\Http\Controllers\Tenant\ListTenantConversationsController;
use App\Modules\Messaging\Http\Controllers\Tenant\ListTenantMessagesController;
use App\Modules\Messaging\Http\Controllers\Tenant\PostTenantMessageController;
use App\Modules\Messaging\Http\Controllers\Tenant\RedactTenantMessageController;
use App\Modules\Messaging\Http\Controllers\Tenant\ShowTenantConversationController;
use App\Modules\Messaging\Http\Controllers\Tenant\StartTenantConversationController;
use App\Modules\Messaging\Http\Controllers\Tenant\TenantUnreadConversationsController;
use App\Modules\Messaging\Http\Controllers\Tenant\UpdateTenantConversationController;
use App\Modules\Messaging\Http\Controllers\UpdateMyTicketController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'no-operator-token', 'verified', 'messaging.private'])->prefix('support')->group(function (): void {
    Route::middleware('throttle:60,1,support-read')->group(function (): void {
        Route::get('/status', SupportStatusController::class)->name('messaging.support.status');
        Route::get('/tickets', ListMyTicketsController::class)->name('messaging.support.tickets.index');
        Route::get('/tickets/{ticket}', ShowMyTicketController::class)->whereUuid('ticket')->name('messaging.support.tickets.show');
        Route::get('/attachments/{attachment}', DownloadMyAttachmentController::class)->whereUuid('attachment')->name('messaging.support.attachments.show');
    });
    Route::get('/tickets/{ticket}/messages', ListMyTicketMessagesController::class)->whereUuid('ticket')->middleware('throttle:120,1,support-poll')->name('messaging.support.tickets.messages.index');
    Route::post('/tickets', OpenTicketController::class)->middleware(['throttle:5,60,support-tickets-open', 'throttle:20,1440,support-tickets-open-day'])->name('messaging.support.tickets.store');
    Route::patch('/tickets/{ticket}', UpdateMyTicketController::class)->whereUuid('ticket')->middleware('throttle:60,1,support-state')->name('messaging.support.tickets.update');
    Route::post('/tickets/{ticket}/messages', ReplyMyTicketController::class)->whereUuid('ticket')->middleware('throttle:30,1,support-reply')->name('messaging.support.tickets.reply');
});

Route::middleware(['auth:sanctum', 'space:operator', 'messaging.private'])->prefix('console/support')->group(function (): void {
    Route::middleware(['operator:admin,support', 'throttle:console-read'])->group(function (): void {
        Route::get('/tickets', ListTicketsController::class)->name('messaging.console.tickets.index');
        Route::get('/stats', TicketStatsController::class)->name('messaging.console.tickets.stats');
        Route::get('/staff', ListStaffController::class)->name('messaging.console.staff.index');
        Route::get('/tickets/{ticket}', ShowTicketController::class)->whereUuid('ticket')->name('messaging.console.tickets.show');
        Route::get('/attachments/{attachment}', DownloadAttachmentController::class)->whereUuid('attachment')->name('messaging.console.attachments.show');
    });
    Route::get('/tickets/{ticket}/messages', ListTicketMessagesController::class)->whereUuid('ticket')->middleware(['operator:admin,support', 'throttle:120,1,console-support-poll'])->name('messaging.console.tickets.messages.index');
    Route::middleware(['operator:admin,support', 'throttle:console-write', 'operator-proof'])->group(function (): void {
        Route::patch('/tickets/{ticket}', UpdateTicketController::class)->whereUuid('ticket')->name('messaging.console.tickets.update');
        Route::post('/tickets/{ticket}/messages', ReplyTicketController::class)->whereUuid('ticket')->name('messaging.console.tickets.reply');
        Route::post('/tickets/{ticket}/access-requests', RequestAccessController::class)->whereUuid('ticket')->middleware('throttle:20,60,console-support-access-request')->name('messaging.console.access.request');
        Route::post('/tickets/{ticket}/emergency-access', OpenEmergencyAccessController::class)->whereUuid('ticket')->middleware('throttle:5,60,console-support-access-emergency')->name('messaging.console.access.emergency');
    });
    Route::post('/access/{grant}/review', ReviewAccessController::class)->whereUuid('grant')->middleware(['operator:admin,compliance', 'throttle:20,60,console-support-access-review', 'operator-proof'])->name('messaging.console.access.review');
});

Route::middleware(['auth:sanctum', 'space:operator', 'messaging.private', 'operator:admin,support', 'throttle:console-read'])->prefix('console/organizations/{organization}')->group(function (): void {
    Route::get('/team', OrganizationTeamController::class)->whereUuid('organization')->middleware('support-access:team')->name('messaging.console.organizations.team');
    Route::get('/settings', OrganizationSettingsController::class)->whereUuid('organization')->middleware('support-access:settings')->name('messaging.console.organizations.settings');
});

Route::middleware(['auth:sanctum', 'space:operator', 'messaging.private', 'operator:admin,support,compliance,billing', 'throttle:console-read'])->prefix('console/organizations/{organization}')->group(function (): void {
    Route::get('/support-accesses', ListOrganizationSupportAccessesController::class)->whereUuid('organization')->name('messaging.console.organizations.support_accesses');
});

Route::middleware(['auth:sanctum', 'space:organization', 'organization', 'entitled:messaging', 'messaging.private'])->prefix('org/{organization}')->group(function (): void {
    Route::middleware('throttle:120,1,org-conversations-read')->group(function (): void {
        Route::get('/conversations', ListConversationsController::class)->name('messaging.conversations.index');
        Route::get('/conversations/stats', ConversationStatsController::class)->name('messaging.conversations.stats');
        Route::get('/conversations/unread', UnreadConversationsController::class)->name('messaging.conversations.unread');
        Route::get('/conversations/recipients', ListRecipientsController::class)->name('messaging.conversations.recipients');
        Route::get('/conversations/{conversation}', ShowConversationController::class)->whereUuid('conversation')->name('messaging.conversations.show');
        Route::get('/conversations/{conversation}/messages', ListConversationMessagesController::class)->whereUuid('conversation')->name('messaging.conversations.messages.index');
        Route::get('/conversation-attachments/{attachment}', DownloadConversationAttachmentController::class)->whereUuid('attachment')->name('messaging.conversations.attachments.show');
    });
    Route::get('/support-access', ListSupportAccessController::class)->middleware('throttle:60,1,org-support-access-read')->name('messaging.support_access.index');
    Route::post('/support-access/{grant}/accept', AcceptSupportAccessController::class)->whereUuid('grant')->middleware(['throttle:10,60,org-support-access-decide', 'two-factor', 'reauthenticated:two-factor'])->name('messaging.support_access.accept');
    Route::post('/support-access/{grant}/refuse', RefuseSupportAccessController::class)->whereUuid('grant')->middleware('throttle:10,60,org-support-access-decide')->name('messaging.support_access.refuse');
    Route::post('/support-access/{grant}/revoke', RevokeSupportAccessController::class)->whereUuid('grant')->middleware('throttle:10,60,org-support-access-decide')->name('messaging.support_access.revoke');
    Route::post('/conversations', StartConversationController::class)->middleware('throttle:30,1')->name('messaging.conversations.store');
    Route::post('/conversations/{conversation}/messages', ReplyConversationController::class)->whereUuid('conversation')->middleware('throttle:60,1')->name('messaging.conversations.reply');
    Route::patch('/conversations/{conversation}', UpdateConversationStateController::class)->whereUuid('conversation')->middleware('throttle:120,1,org-conversations-state')->name('messaging.conversations.update');
    Route::post('/conversations/{conversation}/messages/{message}/redaction', RedactConversationMessageController::class)->whereUuid(['conversation', 'message'])->middleware('throttle:20,1,org-conversations-redact')->name('messaging.conversations.messages.redact');
    Route::post('/conversations/{conversation}/mute', MuteCounterpartController::class)->whereUuid('conversation')->middleware(['throttle:10,1,org-conversations-mute', 'two-factor', 'reauthenticated:two-factor'])->name('messaging.conversations.mute');
    Route::delete('/conversations/{conversation}/mute', UnmuteCounterpartController::class)->whereUuid('conversation')->middleware(['throttle:10,1,org-conversations-mute', 'two-factor'])->name('messaging.conversations.unmute');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:tenant', 'verified', 'messaging.private'])->prefix('tenant')->group(function (): void {
    Route::middleware('throttle:60,1,tenant-conversations-read')->group(function (): void {
        Route::get('/conversations', ListTenantConversationsController::class)->name('messaging.tenant.conversations.index');
        Route::get('/conversations/options', ListTenantConversationOptionsController::class)->name('messaging.tenant.conversations.options');
        Route::get('/conversations/{conversation}', ShowTenantConversationController::class)->whereUuid('conversation')->name('messaging.tenant.conversations.show');
    });
    Route::middleware('throttle:120,1,tenant-conversations-poll')->group(function (): void {
        Route::get('/conversations/unread', TenantUnreadConversationsController::class)->name('messaging.tenant.conversations.unread');
        Route::get('/conversations/{conversation}/messages', ListTenantMessagesController::class)->whereUuid('conversation')->name('messaging.tenant.conversations.messages.index');
    });
    Route::get('/conversation-attachments/{attachment}', DownloadTenantConversationAttachmentController::class)->whereUuid('attachment')->middleware('throttle:30,1,tenant-conversations-download')->name('messaging.tenant.conversations.attachments.show');
    Route::post('/conversations', StartTenantConversationController::class)->middleware(['throttle:5,60,tenant-conversations-open', 'throttle:20,1440,tenant-conversations-open-day'])->name('messaging.tenant.conversations.store');
    Route::patch('/conversations/{conversation}', UpdateTenantConversationController::class)->whereUuid('conversation')->middleware('throttle:60,1,tenant-conversations-state')->name('messaging.tenant.conversations.update');
    Route::post('/conversations/{conversation}/messages', PostTenantMessageController::class)->whereUuid('conversation')->middleware(['throttle:20,1,tenant-conversations-reply', 'throttle:300,1440,tenant-conversations-reply-day'])->name('messaging.tenant.conversations.reply');
    Route::post('/conversations/{conversation}/messages/{message}/redaction', RedactTenantMessageController::class)->whereUuid(['conversation', 'message'])->middleware('throttle:20,1,tenant-conversations-redact')->name('messaging.tenant.conversations.messages.redact');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'messaging.private'])->prefix('owner')->group(function (): void {
    Route::middleware('throttle:60,1,owner-conversations-read')->group(function (): void {
        Route::get('/conversations', ListOwnerConversationsController::class)->name('messaging.owner.conversations.index');
        Route::get('/conversations/options', ListOwnerConversationOptionsController::class)->name('messaging.owner.conversations.options');
        Route::get('/conversations/{conversation}', ShowOwnerConversationController::class)->whereUuid('conversation')->name('messaging.owner.conversations.show');
    });
    Route::middleware('throttle:120,1,owner-conversations-poll')->group(function (): void {
        Route::get('/conversations/unread', OwnerUnreadConversationsController::class)->name('messaging.owner.conversations.unread');
        Route::get('/conversations/{conversation}/messages', ListOwnerMessagesController::class)->whereUuid('conversation')->name('messaging.owner.conversations.messages.index');
    });
    Route::get('/conversation-attachments/{attachment}', DownloadOwnerConversationAttachmentController::class)->whereUuid('attachment')->middleware('throttle:30,1,owner-conversations-download')->name('messaging.owner.conversations.attachments.show');
    Route::middleware(['web-session'])->group(function (): void {
        Route::post('/conversations', StartOwnerConversationController::class)->middleware(['throttle:5,60,owner-conversations-open', 'throttle:20,1440,owner-conversations-open-day'])->name('messaging.owner.conversations.store');
        Route::patch('/conversations/{conversation}', UpdateOwnerConversationController::class)->whereUuid('conversation')->middleware('throttle:60,1,owner-conversations-state')->name('messaging.owner.conversations.update');
        Route::post('/conversations/{conversation}/messages', PostOwnerMessageController::class)->whereUuid('conversation')->middleware(['throttle:20,1,owner-conversations-reply', 'throttle:300,1440,owner-conversations-reply-day'])->name('messaging.owner.conversations.reply');
        Route::post('/conversations/{conversation}/messages/{message}/redaction', RedactOwnerMessageController::class)->whereUuid(['conversation', 'message'])->middleware('throttle:20,1,owner-conversations-redact')->name('messaging.owner.conversations.messages.redact');
    });
});
