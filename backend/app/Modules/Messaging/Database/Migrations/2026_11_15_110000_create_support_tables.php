<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_reference_counters', function (Blueprint $table): void {
            $table->unsignedSmallInteger('year')->primary();
            $table->unsignedInteger('last_value');
        });

        Schema::create('support_tickets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('reference', 20)->unique();
            $table->foreignUuid('requester_user_id')->constrained('users');
            $table->foreignUuid('organization_id')->nullable()->constrained('organizations');
            $table->string('organization_name', 160)->nullable();
            $table->string('space', 16);
            $table->string('category', 16);
            $table->string('subject', 140);
            $table->string('priority', 8)->default('normal');
            $table->string('status', 12)->default('open');
            $table->foreignUuid('assignee_user_id')->nullable()->constrained('users');
            $table->dateTime('first_response_at', 6)->nullable();
            $table->dateTime('resolved_at', 6)->nullable();
            $table->dateTime('last_activity_at', 6);
            $table->datetimes(6);

            $table->index(['status', 'last_activity_at']);
            $table->index(['requester_user_id', 'last_activity_at']);
        });

        Schema::create('support_ticket_messages', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('support_ticket_id')->constrained('support_tickets');
            $table->foreignUuid('author_user_id')->constrained('users');
            $table->boolean('from_support');
            $table->boolean('internal')->default(false);
            $table->text('body');
            $table->dateTime('sent_at', 6);
            $table->datetimes(6);

            $table->index(['support_ticket_id', 'sent_at']);
        });

        Schema::create('support_attachments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('support_ticket_message_id')->constrained('support_ticket_messages');
            $table->string('original_name', 255);
            $table->string('mime_type', 100);
            $table->unsignedInteger('size_bytes');
            $table->string('path', 255);
            $table->datetimes(6);
        });

        Schema::create('support_access_grants', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('support_ticket_id')->constrained('support_tickets');
            $table->foreignUuid('operator_user_id')->constrained('users');
            $table->string('reason', 500);
            $table->dateTime('granted_at', 6);
            $table->dateTime('expires_at', 6);
            $table->datetimes(6);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_status_check CHECK (status IN ('open', 'waiting', 'resolved'))");
            DB::statement("ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_priority_check CHECK (priority IN ('high', 'normal', 'low'))");
            DB::statement("ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_category_check CHECK (category IN ('messaging', 'billing', 'account', 'documents', 'other'))");
            DB::statement("ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_space_check CHECK (space IN ('tenant', 'owner', 'organization', 'marketplace'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('support_access_grants');
        Schema::dropIfExists('support_attachments');
        Schema::dropIfExists('support_ticket_messages');
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('support_reference_counters');
    }
};
