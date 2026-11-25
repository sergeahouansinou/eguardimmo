<?php

declare(strict_types=1);

use App\Modules\Notifications\Enums\MarketingAudience;
use App\Modules\Notifications\Enums\MarketingCategory;
use App\Modules\Notifications\Enums\MarketingChannel;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\PlatformCampaignStatus;
use App\Modules\Notifications\Enums\PlatformDeliveryStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_campaigns', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('channel', 8);
            $table->string('category', 16);
            $table->string('audience', 24);
            $table->unsignedSmallInteger('inactivity_days')->nullable();
            $table->json('recipient_user_ids');
            $table->string('subject', 140)->nullable();
            $table->mediumText('html')->nullable();
            $table->string('push_title', 65)->nullable();
            $table->string('push_body', 240)->nullable();
            $table->string('link', 255)->nullable();
            $table->string('status', 8);
            $table->unsignedInteger('recipient_count')->default(0);
            $table->foreignUuid('created_by_user_id')->constrained('users');
            $table->foreignUuid('sent_by_user_id')->nullable()->constrained('users');
            $table->dateTime('sending_started_at', 6)->nullable();
            $table->dateTime('sent_at', 6)->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->index(['status', 'id'], 'platform_campaigns_status_idx');
        });

        Schema::create('platform_campaign_images', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('campaign_id')->constrained('platform_campaigns');
            $table->string('path', 255);
            $table->string('name', 120);
            $table->string('mime', 32);
            $table->unsignedInteger('size_bytes');
            $table->datetimes(6);
        });

        Schema::create('platform_campaign_deliveries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('campaign_id')->constrained('platform_campaigns');
            $table->foreignUuid('user_id')->constrained('users');
            $table->char('email_hash', 64)->nullable();
            $table->string('status', 20);
            $table->string('provider_message_id', 255)->nullable();
            $table->dateTime('attempted_at', 6)->nullable();
            $table->dateTime('sent_at', 6)->nullable();
            $table->dateTime('bounced_at', 6)->nullable();
            $table->dateTime('unsubscribed_at', 6)->nullable();
            $table->string('error_code', 40)->nullable();
            $table->datetimes(6);

            $table->unique(['campaign_id', 'user_id'], 'platform_deliveries_user_unique');
            $table->index(['campaign_id', 'status'], 'platform_deliveries_status_idx');
            $table->index('provider_message_id', 'platform_deliveries_message_idx');
        });

        Schema::create('reminder_rules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 48)->unique();
            $table->boolean('enabled');
            $table->unsignedSmallInteger('delay_days');
            $table->unsignedSmallInteger('repeat_every_days')->nullable();
            $table->unsignedTinyInteger('max_occurrences');
            $table->json('channels');
            $table->foreignUuid('updated_by_user_id')->nullable()->constrained('users');
            $table->dateTime('last_run_at', 6)->nullable();
            $table->unsignedInteger('last_sent_count')->nullable();
            $table->datetimes(6);
        });

        Schema::create('notification_platform_settings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('type', 48);
            $table->string('channel', 8);
            $table->datetimes(6);

            $table->unique(['type', 'channel'], 'notification_platform_settings_unique');
        });

        Checks::add('platform_campaigns', 'channel', Checks::enum('channel', MarketingChannel::class));
        Checks::add('platform_campaigns', 'category', Checks::enum('category', MarketingCategory::class));
        Checks::add('platform_campaigns', 'audience', Checks::enum('audience', MarketingAudience::class));
        Checks::add('platform_campaigns', 'status', Checks::enum('status', PlatformCampaignStatus::class));
        Checks::add('platform_campaign_deliveries', 'status', Checks::enum('status', PlatformDeliveryStatus::class));
        Checks::add('notification_platform_settings', 'channel', Checks::enum('channel', NotificationChannel::class));
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_platform_settings');
        Schema::dropIfExists('reminder_rules');
        Schema::dropIfExists('platform_campaign_deliveries');
        Schema::dropIfExists('platform_campaign_images');
        Schema::dropIfExists('platform_campaigns');
    }
};
