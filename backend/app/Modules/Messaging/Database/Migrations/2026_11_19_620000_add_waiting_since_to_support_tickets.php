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
        Schema::table('support_tickets', function (Blueprint $table): void {
            $table->dateTime('waiting_since', 6)->nullable();
            $table->index(['status', 'waiting_since']);
        });

        DB::table('support_tickets')->where('status', 'waiting')->update(['waiting_since' => DB::raw('last_activity_at')]);
    }

    public function down(): void
    {
        Schema::table('support_tickets', function (Blueprint $table): void {
            $table->dropIndex(['status', 'waiting_since']);
            $table->dropColumn('waiting_since');
        });
    }
};
