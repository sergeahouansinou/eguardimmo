<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->timestamp('occurred_at', 6);
            $table->string('action', 100);
            $table->uuid('actor_user_id')->nullable();
            $table->uuid('organization_id')->nullable();
            $table->string('subject_type', 50)->nullable();
            $table->uuid('subject_id')->nullable();
            $table->json('changes')->nullable();
            $table->json('metadata');
            $table->uuid('request_id')->nullable()->index();
            $table->string('route', 150)->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent')->nullable();

            $table->index('occurred_at');
            $table->index(['action', 'occurred_at']);
            $table->index(['actor_user_id', 'occurred_at']);
            $table->index(['organization_id', 'occurred_at']);
            $table->index(['subject_type', 'subject_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
