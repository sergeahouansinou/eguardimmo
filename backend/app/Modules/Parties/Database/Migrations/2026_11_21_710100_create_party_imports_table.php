<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('party_imports', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('client_id');
            $table->char('payload_hash', 64);
            $table->json('party_ids');
            $table->unsignedSmallInteger('row_count');
            $table->datetimes(6);

            $table->unique(['organization_id', 'client_id'], 'party_imports_org_client_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('party_imports');
    }
};
