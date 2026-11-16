<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('terms', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->nullable()->constrained('organizations');
            $table->string('vocabulary', 64);
            $table->string('key', 64);
            $table->json('labels');
            $table->string('semantic_key', 64)->nullable();
            $table->foreignUuid('parent_id')->nullable()->constrained('terms');
            $table->unsignedInteger('position')->default(0);
            $table->json('metadata')->nullable();
            $table->boolean('is_system')->default(false);
            $table->dateTime('archived_at', 6)->nullable();
            $table->datetimes(6);
            $table->char('scope_key', 36)->storedAs("coalesce(organization_id, '00000000-0000-0000-0000-000000000000')");

            $table->unique(['scope_key', 'vocabulary', 'key']);
            $table->index(['vocabulary', 'semantic_key']);
        });

        Schema::create('term_overrides', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->foreignUuid('term_id')->constrained('terms');
            $table->json('labels')->nullable();
            $table->boolean('hidden')->default(false);
            $table->unsignedInteger('position')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'term_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('term_overrides');
        Schema::dropIfExists('terms');
    }
};
