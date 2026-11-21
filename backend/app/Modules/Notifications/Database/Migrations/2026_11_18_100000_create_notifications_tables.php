<?php

declare(strict_types=1);

use App\Modules\Notifications\Enums\NotificationAudience;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\PushPlatform;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users');
            $table->foreignUuid('organization_id')->nullable()->constrained('organizations');
            $table->string('audience', 8);
            $table->string('type', 48);
            $table->string('dedup_key', 120);
            $table->string('title', 160);
            $table->string('body', 500);
            $table->string('link', 255)->nullable();
            $table->uuid('lease_id')->nullable();
            $table->boolean('in_app');
            $table->boolean('email');
            $table->boolean('push');
            $table->dateTime('read_at', 6)->nullable();
            $table->dateTime('archived_at', 6)->nullable();
            $table->dateTime('emailed_at', 6)->nullable();
            $table->dateTime('pushed_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique(['user_id', 'type', 'dedup_key']);
            $table->index(['user_id', 'in_app', 'archived_at', 'id']);
            $table->index(['user_id', 'read_at']);
        });

        Schema::create('notification_preferences', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users');
            $table->string('type', 48);
            $table->string('channel', 8);
            $table->boolean('enabled');
            $table->datetimes(6);

            $table->unique(['user_id', 'type', 'channel']);
        });

        Schema::create('push_tokens', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users');
            $table->uuid('access_token_id')->nullable();
            $table->string('platform', 8);
            $table->text('token')->nullable();
            $table->char('token_hash', 64)->unique();
            $table->string('device_name', 120)->nullable();
            $table->dateTime('revoked_at', 6)->nullable();
            $table->datetimes(6);

            $table->index(['user_id', 'revoked_at']);
            $table->index('access_token_id');
        });

        Checks::add('notifications', 'audience', Checks::enum('audience', NotificationAudience::class));
        Checks::add('notification_preferences', 'channel', Checks::enum('channel', NotificationChannel::class));
        Checks::add('push_tokens', 'platform', Checks::enum('platform', PushPlatform::class));
    }

    public function down(): void
    {
        Schema::dropIfExists('push_tokens');
        Schema::dropIfExists('notification_preferences');
        Schema::dropIfExists('notifications');
    }
};
