<?php

declare(strict_types=1);

use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Enums\CampaignStatus;
use App\Modules\Notifications\Enums\DeliveryStatus;
use App\Modules\Notifications\Enums\SuppressionReason;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaigns', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('subject', 140);
            $table->text('body');
            $table->string('audience', 16);
            $table->json('building_ids');
            $table->string('status', 16);
            $table->boolean('copy_to_history')->default(false);
            $table->dateTime('scheduled_at', 6)->nullable();
            $table->dateTime('sending_started_at', 6)->nullable();
            $table->dateTime('sent_at', 6)->nullable();
            $table->dateTime('cancelled_at', 6)->nullable();
            $table->dateTime('content_purged_at', 6)->nullable();
            $table->foreignUuid('created_by_user_id')->constrained('users');
            $table->foreignUuid('sent_by_user_id')->nullable()->constrained('users');
            $table->unsignedInteger('recipient_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->index(['organization_id', 'status', 'id'], 'campaigns_org_status_idx');
            $table->index(['organization_id', 'sending_started_at'], 'campaigns_org_started_idx');
            $table->index(['status', 'scheduled_at'], 'campaigns_status_scheduled_idx');
        });

        Schema::create('campaign_attachments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->foreignUuid('campaign_id')->constrained('campaigns');
            $table->uuid('stored_file_id');
            $table->unsignedTinyInteger('position');
            $table->datetimes(6);

            $table->unique(['campaign_id', 'stored_file_id'], 'campaign_attachments_file_unique');
        });

        Schema::create('campaign_deliveries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->foreignUuid('campaign_id')->constrained('campaigns');
            $table->uuid('party_id');
            $table->uuid('user_id')->nullable();
            $table->uuid('lease_id')->nullable();
            $table->text('email')->nullable();
            $table->char('email_hash', 64)->nullable();
            $table->text('merge_values')->nullable();
            $table->string('status', 20);
            $table->string('provider_message_id', 255)->nullable();
            $table->dateTime('attempted_at', 6)->nullable();
            $table->dateTime('sent_at', 6)->nullable();
            $table->dateTime('bounced_at', 6)->nullable();
            $table->dateTime('unsubscribed_at', 6)->nullable();
            $table->dateTime('read_at', 6)->nullable();
            $table->string('error_code', 40)->nullable();
            $table->datetimes(6);

            $table->unique(['campaign_id', 'party_id'], 'campaign_deliveries_party_unique');
            $table->index(['campaign_id', 'status'], 'campaign_deliveries_status_idx');
            $table->index(['user_id', 'created_at', 'id'], 'campaign_deliveries_user_idx');
            $table->index(['organization_id', 'email_hash'], 'campaign_deliveries_hash_idx');
            $table->index('provider_message_id', 'campaign_deliveries_message_idx');
        });

        Schema::create('mail_suppressions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->nullable()->constrained('organizations');
            $table->string('scope_key', 36);
            $table->char('email_hash', 64);
            $table->string('reason', 16);
            $table->datetimes(6);

            $table->unique(['scope_key', 'email_hash'], 'mail_suppressions_scope_unique');
        });

        Schema::create('mail_provider_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('provider', 24);
            $table->string('event_id', 100);
            $table->string('type', 24);
            $table->uuid('delivery_id')->nullable();
            $table->dateTime('received_at', 6);
            $table->datetimes(6);

            $table->unique(['provider', 'event_id'], 'mail_provider_events_event_unique');
        });

        Checks::add('campaigns', 'status', Checks::enum('status', CampaignStatus::class));
        Checks::add('campaigns', 'audience', Checks::enum('audience', CampaignAudience::class));
        Checks::add('campaign_deliveries', 'status', Checks::enum('status', DeliveryStatus::class));
        Checks::add('mail_suppressions', 'reason', Checks::enum('reason', SuppressionReason::class));
    }

    public function down(): void
    {
        Schema::dropIfExists('mail_provider_events');
        Schema::dropIfExists('mail_suppressions');
        Schema::dropIfExists('campaign_deliveries');
        Schema::dropIfExists('campaign_attachments');
        Schema::dropIfExists('campaigns');
    }
};
