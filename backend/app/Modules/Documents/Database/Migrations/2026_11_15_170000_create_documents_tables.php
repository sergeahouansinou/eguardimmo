<?php

declare(strict_types=1);

use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stored_files', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('disk', 30);
            $table->string('path', 255)->unique();
            $table->string('display_name', 255);
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('size_bytes');
            $table->char('sha256', 64);
            $table->string('category', 20);
            $table->nullableUuidMorphs('subject');
            $table->dateTime('retention_until', 6)->nullable();
            $table->uuid('uploaded_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'subject_type', 'subject_id']);
        });

        Schema::create('document_sequences', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('type', 40);
            $table->unsignedInteger('last_value')->default(0);

            $table->primary(['organization_id', 'type']);
        });

        Schema::create('issued_documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('type', 40);
            $table->unsignedInteger('sequence');
            $table->string('number', 40);
            $table->json('snapshot');
            $table->string('template_version', 40);
            $table->uuid('stored_file_id');
            $table->char('fingerprint', 64);
            $table->nullableUuidMorphs('subject');
            $table->dateTime('issued_at', 6);
            $table->uuid('issued_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'type', 'sequence']);
            $table->unique(['organization_id', 'type', 'number']);
            $table->index(['organization_id', 'subject_type', 'subject_id']);
            $table->foreign(['organization_id', 'stored_file_id'])->references(['organization_id', 'id'])->on('stored_files');
        });

        Schema::create('certificates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuidMorphs('subject');
            $table->foreignUuid('certificate_type_term_id')->constrained('terms');
            $table->string('reference', 120)->nullable();
            $table->uuid('issuer_party_id')->nullable();
            $table->date('issued_on');
            $table->date('expires_on')->nullable();
            $table->json('data')->default(new Expression('(JSON_OBJECT())'));
            $table->uuid('stored_file_id')->nullable();
            $table->uuid('replaces_id')->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique('replaces_id');
            $table->index(['organization_id', 'subject_type', 'subject_id']);
            $table->index(['organization_id', 'expires_on']);
            $table->foreign(['organization_id', 'stored_file_id'])->references(['organization_id', 'id'])->on('stored_files');
            $table->foreign(['organization_id', 'replaces_id'])->references(['organization_id', 'id'])->on('certificates');
        });

        Checks::add('stored_files', 'category', Checks::enum('category', FileCategory::class));
        Checks::add('issued_documents', 'type', Checks::enum('type', IssuedDocumentType::class));
        Checks::add('certificates', 'period', 'expires_on IS NULL OR expires_on >= issued_on');

        foreach ($this->verrous() as $instruction) {
            DB::unprepared($instruction);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('certificates');
        Schema::dropIfExists('issued_documents');
        Schema::dropIfExists('document_sequences');
        Schema::dropIfExists('stored_files');
    }

    /**
     * @return list<literal-string>
     */
    private function verrous(): array
    {
        $message = 'issued_documents est figée après émission';

        return match (DB::getDriverName()) {
            'sqlite' => [
                "CREATE TRIGGER issued_documents_sans_modification BEFORE UPDATE ON issued_documents BEGIN SELECT RAISE(ABORT, '{$message}'); END",
                "CREATE TRIGGER issued_documents_sans_suppression BEFORE DELETE ON issued_documents BEGIN SELECT RAISE(ABORT, '{$message}'); END",
            ],
            'mysql', 'mariadb' => [
                "CREATE TRIGGER issued_documents_sans_modification BEFORE UPDATE ON issued_documents FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$message}'",
                "CREATE TRIGGER issued_documents_sans_suppression BEFORE DELETE ON issued_documents FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$message}'",
            ],
            default => throw new RuntimeException('Pilote de base sans verrou des pièces émises : '.DB::getDriverName()),
        };
    }
};
