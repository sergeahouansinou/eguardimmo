<?php

declare(strict_types=1);

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\CustomFieldType;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('custom_field_definitions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('entity', 32);
            $table->string('key', 64);
            $table->json('labels');
            $table->string('type', 16);
            $table->string('vocabulary', 64)->nullable();
            $table->json('options')->nullable();
            $table->boolean('required')->default(false);
            $table->unsignedInteger('position')->default(0);
            $table->dateTime('values_recorded_at', 6)->nullable();
            $table->dateTime('archived_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'entity', 'key']);
        });

        Checks::add('custom_field_definitions', 'entity', Checks::enum('entity', CustomFieldEntity::class));
        Checks::add('custom_field_definitions', 'type', Checks::enum('type', CustomFieldType::class));
    }

    public function down(): void
    {
        Schema::dropIfExists('custom_field_definitions');
    }
};
