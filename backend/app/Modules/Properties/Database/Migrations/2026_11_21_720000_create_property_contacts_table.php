<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('property_contacts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('property_id');
            $table->uuid('unit_id')->nullable();
            $table->string('unit_key', 36)->storedAs("COALESCE(unit_id, '')");
            $table->uuid('party_id');
            $table->foreignUuid('contact_category_term_id')->nullable()->constrained('terms');
            $table->datetimes(6);

            $table->unique(['organization_id', 'property_id', 'unit_key', 'party_id'], 'property_contacts_unique');
            $table->index(['organization_id', 'party_id'], 'property_contacts_org_party_idx');
            $table->foreign(['organization_id', 'property_id'], 'property_contacts_property_fk')->references(['organization_id', 'id'])->on('properties');
            $table->foreign(['organization_id', 'unit_id'], 'property_contacts_unit_fk')->references(['organization_id', 'id'])->on('units');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('property_contacts');
    }
};
