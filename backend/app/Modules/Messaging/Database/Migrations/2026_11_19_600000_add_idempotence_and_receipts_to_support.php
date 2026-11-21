<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_tickets', function (Blueprint $table): void {
            $table->uuid('client_id')->nullable();
            $table->dateTime('requester_last_read_at', 6)->nullable();
            $table->dateTime('support_last_read_at', 6)->nullable();

            $table->unique(['requester_user_id', 'client_id']);
            $table->index(['status', 'resolved_at']);
        });

        Schema::table('support_ticket_messages', function (Blueprint $table): void {
            $table->uuid('client_id')->nullable();

            $table->unique(['support_ticket_id', 'author_user_id', 'client_id'], 'support_messages_idempotence_unique');
        });
    }

    public function down(): void
    {
        Schema::table('support_ticket_messages', function (Blueprint $table): void {
            $table->dropUnique('support_messages_idempotence_unique');
            $table->dropColumn('client_id');
        });

        Schema::table('support_tickets', function (Blueprint $table): void {
            $table->dropIndex(['status', 'resolved_at']);
            $table->dropUnique(['requester_user_id', 'client_id']);
            $table->dropColumn(['client_id', 'requester_last_read_at', 'support_last_read_at']);
        });
    }
};
