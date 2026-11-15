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
        Schema::create('properties', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('name', 200);
            $table->string('type', 16);
            $table->json('address');
            $table->json('custom_fields');
            $table->unsignedInteger('lock_version')->default(1);
            $table->dateTime('archived_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'name', 'id']);
        });

        Schema::create('units', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('property_id');
            $table->uuid('parent_unit_id')->nullable();
            $table->foreignUuid('unit_type_term_id')->constrained('terms');
            $table->string('reference', 60);
            $table->smallInteger('floor')->nullable();
            $table->unsignedInteger('surface_hundredths')->nullable();
            $table->json('characteristics');
            $table->json('custom_fields');
            $table->unsignedInteger('lock_version')->default(1);
            $table->dateTime('archived_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'property_id', 'reference']);
            $table->index(['organization_id', 'reference', 'id']);
            $table->index('parent_unit_id');
            $table->index('unit_type_term_id');
            $table->foreign(['organization_id', 'property_id'])->references(['organization_id', 'id'])->on('properties');
            $table->foreign(['organization_id', 'parent_unit_id'])->references(['organization_id', 'id'])->on('units');
        });

        Schema::create('unit_ownerships', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('unit_id');
            $table->uuid('party_id');
            $table->unsignedSmallInteger('share_bp');
            $table->string('nature', 16);
            $table->date('valid_from');
            $table->date('valid_to')->nullable();
            $table->datetimes(6);

            $table->index(['unit_id', 'nature', 'valid_from']);
            $table->index(['organization_id', 'party_id']);
            $table->foreign(['organization_id', 'unit_id'])->references(['organization_id', 'id'])->on('units');
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE properties ADD CONSTRAINT properties_type_check CHECK (type IN ('building', 'house', 'complex'))");
            DB::statement('ALTER TABLE units ADD CONSTRAINT units_parent_check CHECK (parent_unit_id IS NULL OR parent_unit_id <> id)');
            DB::statement("ALTER TABLE unit_ownerships ADD CONSTRAINT unit_ownerships_nature_check CHECK (nature IN ('full', 'bare', 'usufruct'))");
            DB::statement('ALTER TABLE unit_ownerships ADD CONSTRAINT unit_ownerships_share_check CHECK (share_bp BETWEEN 1 AND 10000)');
            DB::statement('ALTER TABLE unit_ownerships ADD CONSTRAINT unit_ownerships_period_check CHECK (valid_to IS NULL OR valid_to > valid_from)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('unit_ownerships');
        Schema::dropIfExists('units');
        Schema::dropIfExists('properties');
    }
};
