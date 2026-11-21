<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\LeaseDocumentKind;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lease_documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->uuid('party_id')->nullable();
            $table->uuid('stored_file_id');
            $table->string('kind', 16);
            $table->uuid('shared_by_user_id');
            $table->dateTime('shared_at', 6);
            $table->dateTime('revoked_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'lease_id', 'shared_at'], 'lease_documents_lease_idx');
            $table->foreign(['organization_id', 'lease_id'])->references(['organization_id', 'id'])->on('leases');
        });

        Checks::add('lease_documents', 'kind', Checks::enum('kind', LeaseDocumentKind::class));
    }

    public function down(): void
    {
        Schema::dropIfExists('lease_documents');
    }
};
