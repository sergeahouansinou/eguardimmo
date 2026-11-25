<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('geo_countries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 2)->unique();
            $table->string('name', 80);
            $table->datetimes(6);
        });

        Schema::create('geo_cities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('country_id')->constrained('geo_countries');
            $table->string('name', 120);
            $table->string('postal_code', 10);
            $table->string('slug', 140);
            $table->decimal('latitude', 8, 6);
            $table->decimal('longitude', 9, 6);
            $table->datetimes(6);

            $table->unique(['country_id', 'slug'], 'geo_cities_country_slug_unique');
            $table->index('name', 'geo_cities_name_idx');
            $table->index('postal_code', 'geo_cities_postal_code_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('geo_cities');
        Schema::dropIfExists('geo_countries');
    }
};
