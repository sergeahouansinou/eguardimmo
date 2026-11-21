<?php

declare(strict_types=1);

use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\ConversationStatus;
use App\Modules\Messaging\Enums\MessageSide;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table): void {
            $table->string('kind', 20)->default(ConversationKind::Internal->value);
            $table->string('last_author_side', 20)->default(MessageSide::Staff->value);
            $table->uuid('party_id')->nullable();
            $table->uuid('lease_id')->nullable();
            $table->uuid('mandate_id')->nullable();
            $table->uuid('intervention_id')->nullable();
            $table->uuid('client_id')->nullable();
            $table->string('status', 20)->default(ConversationStatus::Open->value);
            $table->dateTime('closed_at', 6)->nullable();
            $table->foreignUuid('closed_by_user_id')->nullable()->constrained('users');
            $table->foreignUuid('assignee_user_id')->nullable()->constrained('users');
            $table->dateTime('counterpart_muted_until', 6)->nullable();
            $table->string('counterpart_muted_reason', 500)->nullable();
            $table->dateTime('retention_until', 6)->nullable();

            $table->index(['organization_id', 'kind', 'last_message_at']);
            $table->index(['organization_id', 'party_id']);
            $table->unique(['created_by_user_id', 'client_id'], 'conversations_open_client_unique');
        });

        Schema::table('conversation_participants', function (Blueprint $table): void {
            $table->string('side', 20)->default(MessageSide::Staff->value);
        });

        Schema::table('conversation_messages', function (Blueprint $table): void {
            $table->string('author_side', 20)->default(MessageSide::Staff->value);
            $table->uuid('client_id')->nullable();
            $table->dateTime('redacted_at', 6)->nullable();
            $table->foreignUuid('redacted_by_user_id')->nullable()->constrained('users');
            $table->string('redaction_reason', 500)->nullable();

            $table->unique(['conversation_id', 'author_user_id', 'client_id'], 'conversation_messages_client_unique');
            $table->index(['author_user_id', 'client_id']);
        });

        Schema::table('conversation_attachments', function (Blueprint $table): void {
            $table->uuid('stored_file_id')->nullable();
            $table->string('path', 255)->nullable()->change();
            $table->index('stored_file_id');
        });

        Checks::add('conversations', 'kind', Checks::enum('kind', ConversationKind::class));
        Checks::add('conversations', 'last_author_side', Checks::enum('last_author_side', MessageSide::class));
        Checks::add('conversations', 'status', Checks::enum('status', ConversationStatus::class));
        Checks::add('conversations', 'kind_keys', "((kind = 'tenant' AND party_id IS NOT NULL AND lease_id IS NOT NULL AND mandate_id IS NULL) OR (kind = 'owner' AND party_id IS NOT NULL AND lease_id IS NULL) OR (kind = 'internal' AND party_id IS NULL AND lease_id IS NULL AND mandate_id IS NULL))");
        Checks::add('conversation_participants', 'side', Checks::enum('side', MessageSide::class));
        Checks::add('conversation_messages', 'author_side', Checks::enum('author_side', MessageSide::class));
    }

    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE conversation_messages DROP CONSTRAINT conversation_messages_author_side_check');
            DB::statement('ALTER TABLE conversation_participants DROP CONSTRAINT conversation_participants_side_check');
            DB::statement('ALTER TABLE conversations DROP CONSTRAINT conversations_kind_keys_check');
            DB::statement('ALTER TABLE conversations DROP CONSTRAINT conversations_last_author_side_check');
            DB::statement('ALTER TABLE conversations DROP CONSTRAINT conversations_status_check');
            DB::statement('ALTER TABLE conversations DROP CONSTRAINT conversations_kind_check');
        }

        Schema::table('conversation_attachments', function (Blueprint $table): void {
            $table->dropIndex(['stored_file_id']);
            $table->dropColumn('stored_file_id');
        });

        Schema::table('conversation_messages', function (Blueprint $table): void {
            $table->dropIndex(['author_user_id', 'client_id']);
            $table->dropUnique('conversation_messages_client_unique');
            $table->dropConstrainedForeignId('redacted_by_user_id');
            $table->dropColumn(['author_side', 'client_id', 'redacted_at', 'redaction_reason']);
        });

        Schema::table('conversation_participants', function (Blueprint $table): void {
            $table->dropColumn('side');
        });

        Schema::table('conversations', function (Blueprint $table): void {
            $table->dropIndex(['organization_id', 'kind', 'last_message_at']);
            $table->dropIndex(['organization_id', 'party_id']);
            $table->dropUnique('conversations_open_client_unique');
            $table->dropConstrainedForeignId('closed_by_user_id');
            $table->dropConstrainedForeignId('assignee_user_id');
            $table->dropColumn(['kind', 'last_author_side', 'party_id', 'lease_id', 'mandate_id', 'intervention_id', 'client_id', 'status', 'closed_at', 'counterpart_muted_until', 'counterpart_muted_reason', 'retention_until']);
        });
    }
};
