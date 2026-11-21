<?php

declare(strict_types=1);

use App\Modules\Notifications\Http\Controllers\ListNotificationsController;
use App\Modules\Notifications\Http\Controllers\Mail\MailWebhookController;
use App\Modules\Notifications\Http\Controllers\Mail\ShowUnsubscriptionController;
use App\Modules\Notifications\Http\Controllers\Mail\UnsubscribeController;
use App\Modules\Notifications\Http\Controllers\MarkAllNotificationsReadController;
use App\Modules\Notifications\Http\Controllers\MarkNotificationReadController;
use App\Modules\Notifications\Http\Controllers\Organization\CancelCampaignController;
use App\Modules\Notifications\Http\Controllers\Organization\CreateCampaignController;
use App\Modules\Notifications\Http\Controllers\Organization\DeleteCampaignAttachmentController;
use App\Modules\Notifications\Http\Controllers\Organization\DownloadCampaignAttachmentController;
use App\Modules\Notifications\Http\Controllers\Organization\ListCampaignsController;
use App\Modules\Notifications\Http\Controllers\Organization\ScheduleCampaignController;
use App\Modules\Notifications\Http\Controllers\Organization\SendCampaignController;
use App\Modules\Notifications\Http\Controllers\Organization\SendCampaignTestController;
use App\Modules\Notifications\Http\Controllers\Organization\ShowCampaignAudiencesController;
use App\Modules\Notifications\Http\Controllers\Organization\ShowCampaignController;
use App\Modules\Notifications\Http\Controllers\Organization\UpdateCampaignController;
use App\Modules\Notifications\Http\Controllers\Organization\UploadCampaignAttachmentController;
use App\Modules\Notifications\Http\Controllers\Owner\DownloadOwnerAnnouncementAttachmentController;
use App\Modules\Notifications\Http\Controllers\Owner\ListOwnerAnnouncementsController;
use App\Modules\Notifications\Http\Controllers\Owner\ReadOwnerAnnouncementController;
use App\Modules\Notifications\Http\Controllers\Owner\ShowOwnerAnnouncementController;
use App\Modules\Notifications\Http\Controllers\RegisterPushTokenController;
use App\Modules\Notifications\Http\Controllers\RevokePushTokenController;
use App\Modules\Notifications\Http\Controllers\SavePreferencesController;
use App\Modules\Notifications\Http\Controllers\ShowPreferencesController;
use App\Modules\Notifications\Http\Controllers\Tenant\DownloadTenantAnnouncementAttachmentController;
use App\Modules\Notifications\Http\Controllers\Tenant\ListTenantAnnouncementsController;
use App\Modules\Notifications\Http\Controllers\Tenant\ReadTenantAnnouncementController;
use App\Modules\Notifications\Http\Controllers\Tenant\ShowTenantAnnouncementController;
use App\Modules\Notifications\Http\Controllers\UnreadCountController;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Route;

$lecture = 'throttle:'.config('notifications.rate_limits.read_per_minute').',1,notifications-read';
$ecriture = 'throttle:'.config('notifications.rate_limits.write_per_minute').',1,notifications-write';
$appareil = 'throttle:'.config('notifications.rate_limits.push_token_per_minute').',1,notifications-push-token';

Route::middleware(['auth:sanctum', 'no-operator-token'])->group(function () use ($lecture, $ecriture, $appareil): void {
    Route::prefix('notifications')->group(function () use ($lecture, $ecriture): void {
        Route::get('/', ListNotificationsController::class)->middleware($lecture)->name('notifications.index');
        Route::get('/unread-count', UnreadCountController::class)->middleware($lecture)->name('notifications.unread-count');
        Route::get('/preferences', ShowPreferencesController::class)->middleware($lecture)->name('notifications.preferences.show');
        Route::put('/preferences', SavePreferencesController::class)->middleware($ecriture)->name('notifications.preferences.update');
        Route::post('/read-all', MarkAllNotificationsReadController::class)->middleware($ecriture)->name('notifications.read-all');
        Route::post('/{notification}/read', MarkNotificationReadController::class)->whereUuid('notification')->middleware($ecriture)->name('notifications.read');
    });

    Route::post('/me/push-tokens', RegisterPushTokenController::class)->middleware($appareil)->name('notifications.push-tokens.store');
    Route::delete('/me/push-tokens/{pushToken}', RevokePushTokenController::class)->whereUuid('pushToken')->middleware($ecriture)->name('notifications.push-tokens.destroy');
});

Route::middleware(['auth:sanctum', 'space:organization', 'organization', 'entitled:campaigns', 'campaigns.manage', 'campaigns.private'])->prefix('org/{organization}/campaigns')->group(function (): void {
    Route::middleware('throttle:120,1,org-campaigns-read')->group(function (): void {
        Route::get('/', ListCampaignsController::class)->name('notifications.campaigns.index');
        Route::get('/audiences', ShowCampaignAudiencesController::class)->name('notifications.campaigns.audiences');
        Route::get('/{campaign}', ShowCampaignController::class)->whereUuid('campaign')->name('notifications.campaigns.show');
        Route::get('/{campaign}/attachments/{attachment}', DownloadCampaignAttachmentController::class)->whereUuid(['campaign', 'attachment'])->name('notifications.campaigns.attachments.show');
    });
    Route::middleware('throttle:60,1,org-campaigns-write')->group(function (): void {
        Route::post('/', CreateCampaignController::class)->name('notifications.campaigns.store');
        Route::patch('/{campaign}', UpdateCampaignController::class)->whereUuid('campaign')->name('notifications.campaigns.update');
        Route::post('/{campaign}/cancel', CancelCampaignController::class)->whereUuid('campaign')->name('notifications.campaigns.cancel');
        Route::delete('/{campaign}/attachments/{attachment}', DeleteCampaignAttachmentController::class)->whereUuid(['campaign', 'attachment'])->name('notifications.campaigns.attachments.destroy');
    });
    Route::post('/{campaign}/attachments', UploadCampaignAttachmentController::class)->whereUuid('campaign')->middleware('throttle:20,1,org-campaigns-upload')->name('notifications.campaigns.attachments.store');
    Route::post('/test', SendCampaignTestController::class)->middleware('throttle:org-campaigns-test')->name('notifications.campaigns.test');
    Route::post('/{campaign}/send', SendCampaignController::class)->whereUuid('campaign')->middleware(['throttle:10,60,org-campaigns-send', 'two-factor', 'reauthenticated:two-factor'])->name('notifications.campaigns.send');
    Route::post('/{campaign}/schedule', ScheduleCampaignController::class)->whereUuid('campaign')->middleware(['throttle:10,60,org-campaigns-send', 'two-factor', 'reauthenticated:two-factor'])->name('notifications.campaigns.schedule');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:tenant', 'verified', 'campaigns.private'])->prefix('tenant/announcements')->group(function (): void {
    Route::middleware('throttle:60,1,tenant-announcements-read')->group(function (): void {
        Route::get('/', ListTenantAnnouncementsController::class)->name('notifications.tenant.announcements.index');
        Route::get('/{campaign}', ShowTenantAnnouncementController::class)->whereUuid('campaign')->name('notifications.tenant.announcements.show');
    });
    Route::post('/{campaign}/read', ReadTenantAnnouncementController::class)->whereUuid('campaign')->middleware('throttle:120,1,tenant-announcements-read-mark')->name('notifications.tenant.announcements.read');
    Route::get('/{campaign}/attachments/{attachment}', DownloadTenantAnnouncementAttachmentController::class)->whereUuid(['campaign', 'attachment'])->middleware('throttle:30,1,tenant-announcements-download')->name('notifications.tenant.announcements.attachments.show');
});

Route::middleware(['auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'campaigns.private'])->prefix('owner/announcements')->group(function (): void {
    Route::middleware('throttle:60,1,owner-announcements-read')->group(function (): void {
        Route::get('/', ListOwnerAnnouncementsController::class)->name('notifications.owner.announcements.index');
        Route::get('/{campaign}', ShowOwnerAnnouncementController::class)->whereUuid('campaign')->name('notifications.owner.announcements.show');
    });
    Route::post('/{campaign}/read', ReadOwnerAnnouncementController::class)->whereUuid('campaign')->middleware(['web-session', 'throttle:120,1,owner-announcements-read-mark'])->name('notifications.owner.announcements.read');
    Route::get('/{campaign}/attachments/{attachment}', DownloadOwnerAnnouncementAttachmentController::class)->whereUuid(['campaign', 'attachment'])->middleware('throttle:30,1,owner-announcements-download')->name('notifications.owner.announcements.attachments.show');
});

Route::get('/mail/unsubscribe/{token}', ShowUnsubscriptionController::class)->where('token', '[A-Za-z0-9_.\-]+')->middleware('throttle:mail-unsubscribe')->withoutMiddleware(ThrottleRequests::class.':api')->name('notifications.mail.unsubscribe.show');
Route::post('/mail/unsubscribe/{token}', UnsubscribeController::class)->where('token', '[A-Za-z0-9_.\-]+')->middleware('throttle:mail-unsubscribe')->withoutMiddleware(ThrottleRequests::class.':api')->name('notifications.mail.unsubscribe.store');
Route::post('/webhooks/mail/mailtrap', MailWebhookController::class)->middleware('throttle:mail-webhook')->withoutMiddleware(ThrottleRequests::class.':api')->name('notifications.webhooks.mailtrap');
