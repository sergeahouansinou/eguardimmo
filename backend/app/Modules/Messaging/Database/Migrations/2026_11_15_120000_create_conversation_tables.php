<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('subject', 140);
            $table->foreignUuid('created_by_user_id')->constrained('users');
            $table->dateTime('last_message_at', 6);
            $table->foreignUuid('last_author_user_id')->constrained('users');
            $table->datetimes(6);

            $table->index(['organization_id', 'last_message_at']);
        });

        Schema::create('conversation_participants', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->foreignUuid('conversation_id')->constrained('conversations');
            $table->foreignUuid('user_id')->constrained('users');
            $table->dateTime('last_read_at', 6)->nullable();
            $table->dateTime('archived_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique(['conversation_id', 'user_id']);
            $table->index(['organization_id', 'user_id']);
        });

        Schema::create('conversation_messages', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->foreignUuid('conversation_id')->constrained('conversations');
            $table->foreignUuid('author_user_id')->constrained('users');
            $table->text('body');
            $table->dateTime('sent_at', 6);
            $table->datetimes(6);

            $table->index(['conversation_id', 'sent_at']);
        });

        Schema::create('conversation_attachments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->foreignUuid('conversation_message_id')->constrained('conversation_messages');
            $table->string('original_name', 255);
            $table->string('mime_type', 100);
            $table->unsignedInteger('size_bytes');
            $table->string('path', 255);
            $table->datetimes(6);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_attachments');
        Schema::dropIfExists('conversation_messages');
        Schema::dropIfExists('conversation_participants');
        Schema::dropIfExists('conversations');
    }
};
