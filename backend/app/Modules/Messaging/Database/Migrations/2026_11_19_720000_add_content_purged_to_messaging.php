<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table): void {
            $table->dateTime('content_purged_at', 6)->nullable();

            $table->index(['content_purged_at', 'last_message_at'], 'conversations_purge_index');
        });

        Schema::table('support_tickets', function (Blueprint $table): void {
            $table->dateTime('content_purged_at', 6)->nullable();

            $table->index(['content_purged_at', 'resolved_at'], 'support_tickets_purge_index');
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table): void {
            $table->dropIndex('conversations_purge_index');
            $table->dropColumn('content_purged_at');
        });

        Schema::table('support_tickets', function (Blueprint $table): void {
            $table->dropIndex('support_tickets_purge_index');
            $table->dropColumn('content_purged_at');
        });
    }
};
