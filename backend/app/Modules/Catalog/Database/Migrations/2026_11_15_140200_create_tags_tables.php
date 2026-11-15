<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tags', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('name', 60);
            $table->string('slug', 80);
            $table->char('color', 7)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'slug']);
        });

        Schema::create('taggings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->foreignUuid('tag_id')->constrained('tags');
            $table->uuidMorphs('taggable');
            $table->datetimes(6);

            $table->unique(['tag_id', 'taggable_type', 'taggable_id']);
            $table->index(['organization_id', 'taggable_type', 'taggable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('taggings');
        Schema::dropIfExists('tags');
    }
};
