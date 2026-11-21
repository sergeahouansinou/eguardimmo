<?php

declare(strict_types=1);

use App\Modules\Inspections\Enums\InspectionKind;
use App\Modules\Inspections\Enums\InspectionPerformer;
use App\Modules\Inspections\Enums\RemarkAnswer;
use App\Modules\Inspections\Enums\RemarkKind;
use App\Modules\Inspections\Enums\RemarkStatus;
use App\Shared\Database\Checks;
use App\Shared\Database\RowGuards;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const COLONNES_REMARQUES = ['id', 'organization_id', 'inspection_id', 'party_id', 'author_user_id', 'kind', 'body', 'client_id', 'status', 'answer', 'answer_body', 'answered_by_user_id', 'answered_at', 'created_at', 'updated_at'];

    private const COLONNES_FICHIERS = ['id', 'organization_id', 'remark_id', 'stored_file_id', 'position', 'created_at'];

    public function up(): void
    {
        Schema::create('inspections', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->string('kind', 8);
            $table->date('performed_on');
            $table->string('performed_by', 8);
            $table->uuid('stored_file_id');
            $table->text('signatories');
            $table->boolean('exit_matches_entry')->nullable();
            $table->dateTime('published_at', 6)->nullable();
            $table->uuid('published_by_user_id')->nullable();
            $table->uuid('created_by_user_id');
            $table->uuid('client_id');
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'client_id'], 'inspections_client_unique');
            $table->index(['organization_id', 'lease_id', 'performed_on'], 'inspections_lease_idx');
            $table->index(['lease_id', 'published_at'], 'inspections_published_idx');
        });

        Checks::add('inspections', 'kind', Checks::enum('kind', InspectionKind::class));
        Checks::add('inspections', 'performed_by', Checks::enum('performed_by', InspectionPerformer::class));

        Schema::create('inspection_remarks', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('inspection_id');
            $table->uuid('party_id');
            $table->uuid('author_user_id');
            $table->string('kind', 12);
            $table->text('body');
            $table->uuid('client_id');
            $table->string('status', 8)->default('open');
            $table->string('answer', 8)->nullable();
            $table->text('answer_body')->nullable();
            $table->uuid('answered_by_user_id')->nullable();
            $table->dateTime('answered_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['inspection_id', 'party_id', 'client_id'], 'inspection_remarks_client_unique');
            $table->index(['organization_id', 'inspection_id', 'created_at'], 'inspection_remarks_inspection_idx');
            $table->index(['party_id', 'inspection_id'], 'inspection_remarks_party_idx');
            $table->foreign(['organization_id', 'inspection_id'], 'inspection_remarks_inspection_fk')->references(['organization_id', 'id'])->on('inspections');
        });

        Checks::add('inspection_remarks', 'kind', Checks::enum('kind', RemarkKind::class));
        Checks::add('inspection_remarks', 'status', Checks::enum('status', RemarkStatus::class));
        Checks::add('inspection_remarks', 'answer', Checks::enum('answer', RemarkAnswer::class, true));

        Schema::create('inspection_remark_files', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('remark_id');
            $table->uuid('stored_file_id');
            $table->unsignedTinyInteger('position');
            $table->dateTime('created_at', 6);

            $table->unique(['remark_id', 'position'], 'inspection_remark_files_position_unique');
            $table->foreign(['organization_id', 'remark_id'], 'inspection_remark_files_remark_fk')->references(['organization_id', 'id'])->on('inspection_remarks');
        });

        RowGuards::install([
            ...RowGuards::frozenExcept('inspection_remarks', self::COLONNES_REMARQUES, ['status', 'body', 'answer', 'answer_body', 'answered_by_user_id', 'answered_at', 'updated_at']),
            ...RowGuards::frozenExcept('inspection_remark_files', self::COLONNES_FICHIERS, []),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('inspection_remark_files');
        Schema::dropIfExists('inspection_remarks');
        Schema::dropIfExists('inspections');
    }
};
