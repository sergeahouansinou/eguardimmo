<?php

declare(strict_types=1);

use App\Modules\Documents\Enums\LibraryKind;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('library_documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('stored_file_id');
            $table->string('kind', 16);
            $table->dateTime('archived_at', 6)->nullable();
            $table->uuid('filed_by_user_id')->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'stored_file_id'], 'library_documents_org_file_unique');
            $table->index(['organization_id', 'kind', 'id'], 'library_documents_org_kind_id_idx');
            $table->index(['organization_id', 'archived_at', 'id'], 'library_documents_org_archived_id_idx');
            // La purge (ADR 0033) supprime le fichier : l'entrée de bibliothèque, simple index du fichier, part avec lui.
            $table->foreign(['organization_id', 'stored_file_id'])->references(['organization_id', 'id'])->on('stored_files')->cascadeOnDelete();
        });

        Checks::add('library_documents', 'kind', Checks::enum('kind', LibraryKind::class));
    }

    public function down(): void
    {
        Schema::dropIfExists('library_documents');
    }
};
