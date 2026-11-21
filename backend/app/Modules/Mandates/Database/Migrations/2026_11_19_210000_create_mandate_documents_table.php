<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\DocumentUploader;
use App\Modules\Mandates\Enums\MandateDocumentKind;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mandate_documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('mandate_id');
            $table->uuid('stored_file_id');
            $table->string('kind', 16);
            $table->string('uploaded_by_kind', 16);
            $table->uuid('shared_by_user_id')->nullable();
            $table->dateTime('shared_at', 6)->nullable();
            $table->dateTime('revoked_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'mandate_id', 'shared_at']);
            $table->foreign(['organization_id', 'mandate_id'])->references(['organization_id', 'id'])->on('mandates');
        });

        Checks::add('mandate_documents', 'kind', Checks::enum('kind', MandateDocumentKind::class));
        Checks::add('mandate_documents', 'uploaded_by_kind', Checks::enum('uploaded_by_kind', DocumentUploader::class));
        Checks::add('mandate_documents', 'revoked', 'revoked_at IS NULL OR shared_at IS NOT NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('mandate_documents');
    }
};
