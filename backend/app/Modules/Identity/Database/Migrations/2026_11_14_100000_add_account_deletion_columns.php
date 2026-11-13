<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->softDeletes();
        });

        Schema::table('social_identities', function (Blueprint $table): void {
            $table->string('apple_client_id')->nullable()->after('apple_refresh_token');
        });
    }

    public function down(): void
    {
        Schema::table('social_identities', function (Blueprint $table): void {
            $table->dropColumn('apple_client_id');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropSoftDeletes();
        });
    }
};
