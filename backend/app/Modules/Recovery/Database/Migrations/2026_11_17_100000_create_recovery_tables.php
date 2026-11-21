<?php

declare(strict_types=1);

use App\Modules\Recovery\Enums\ActType;
use App\Modules\Recovery\Enums\CaseStatus;
use App\Modules\Recovery\Enums\ItemType;
use App\Modules\Recovery\Enums\SequenceKind;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recovery_sequences', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('kind', 16);
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('last_value')->default(0);

            $table->primary(['organization_id', 'kind', 'year']);
        });

        Schema::create('recovery_cases', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('number', 24);
            $table->uuid('lease_id');
            $table->uuid('debtor_party_id');
            $table->string('status', 16);
            $table->char('currency', 3);
            $table->date('opened_on');
            $table->date('closed_on')->nullable();
            $table->string('status_reason', 255)->nullable();
            $table->uuid('opened_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'number']);
            $table->index(['organization_id', 'status', 'opened_on']);
            $table->index(['organization_id', 'lease_id', 'debtor_party_id', 'status'], 'recovery_cases_lease_debtor_status_index');
        });

        Schema::create('recovery_case_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('case_id');
            $table->string('item_type', 16);
            $table->uuid('item_id');
            $table->char('currency', 3);
            $table->date('period_start');
            $table->date('period_end');
            $table->date('due_date');
            $table->unsignedBigInteger('total_amount');
            $table->unsignedBigInteger('amount_due');
            $table->dateTime('included_at', 6);
            $table->uuid('included_by_user_id')->nullable();
            $table->dateTime('removed_at', 6)->nullable();
            $table->uuid('removed_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'item_type', 'item_id']);
            $table->index(['case_id', 'removed_at']);
            $table->foreign(['organization_id', 'case_id'])->references(['organization_id', 'id'])->on('recovery_cases');
        });

        Schema::create('recovery_acts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('case_id');
            $table->string('type', 24);
            $table->date('performed_on');
            $table->uuid('author_user_id')->nullable();
            $table->string('reference', 120)->nullable();
            $table->string('note', 500)->nullable();
            $table->json('data')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['case_id', 'performed_on']);
            $table->foreign(['organization_id', 'case_id'])->references(['organization_id', 'id'])->on('recovery_cases');
        });

        Schema::create('recovery_bundles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('case_id');
            $table->string('number', 24);
            $table->uuid('stored_file_id');
            $table->char('sha256', 64);
            $table->unsignedBigInteger('size_bytes');
            $table->json('pieces');
            $table->json('statement');
            $table->char('currency', 3);
            $table->unsignedBigInteger('total_due');
            $table->date('generated_on');
            $table->uuid('generated_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'number']);
            $table->index(['case_id', 'generated_on']);
            $table->foreign(['organization_id', 'case_id'])->references(['organization_id', 'id'])->on('recovery_cases');
        });

        Schema::create('recovery_transmissions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('bundle_id');
            $table->uuid('recipient_party_id');
            $table->string('recipient_email', 254);
            $table->char('token_hash', 64);
            $table->dateTime('expires_at', 6);
            $table->dateTime('revoked_at', 6)->nullable();
            $table->uuid('revoked_by_user_id')->nullable();
            $table->dateTime('sent_at', 6)->nullable();
            $table->dateTime('first_downloaded_at', 6)->nullable();
            $table->unsignedInteger('download_count')->default(0);
            $table->uuid('replaces_id')->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique('token_hash');
            $table->index(['bundle_id', 'created_at']);
            $table->foreign(['organization_id', 'bundle_id'])->references(['organization_id', 'id'])->on('recovery_bundles');
        });

        Schema::create('recovery_transmission_downloads', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('transmission_id');
            $table->string('ip', 45);
            $table->dateTime('downloaded_at', 6);

            $table->unique(['organization_id', 'id']);
            $table->index(['transmission_id', 'downloaded_at'], 'recovery_transmission_downloads_trans_downloaded_index');
            $table->foreign(['organization_id', 'transmission_id'], 'recovery_transmission_downloads_org_transmission_foreign')->references(['organization_id', 'id'])->on('recovery_transmissions');
        });

        Checks::add('recovery_sequences', 'kind', Checks::enum('kind', SequenceKind::class));
        Checks::add('recovery_cases', 'status', Checks::enum('status', CaseStatus::class));
        Checks::add('recovery_cases', 'currency', Checks::uppercase('currency', 3));
        Checks::add('recovery_case_items', 'item_type', Checks::enum('item_type', ItemType::class));
        Checks::add('recovery_case_items', 'currency', Checks::uppercase('currency', 3));
        Checks::add('recovery_case_items', 'removal', 'removed_at IS NULL OR removed_at >= included_at');
        Checks::add('recovery_acts', 'type', Checks::enum('type', ActType::class));
        Checks::add('recovery_bundles', 'currency', Checks::uppercase('currency', 3));

        foreach ($this->verrous() as $instruction) {
            DB::unprepared($instruction);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('recovery_transmission_downloads');
        Schema::dropIfExists('recovery_transmissions');
        Schema::dropIfExists('recovery_bundles');
        Schema::dropIfExists('recovery_acts');
        Schema::dropIfExists('recovery_case_items');
        Schema::dropIfExists('recovery_cases');
        Schema::dropIfExists('recovery_sequences');
    }

    /**
     * Aucune suppression physique ; carnet, envois et journal des téléchargements sont en outre figés après création.
     *
     * @return list<literal-string>
     */
    private function verrous(): array
    {
        return match (DB::getDriverName()) {
            'sqlite' => [
                "CREATE TRIGGER recovery_cases_sans_suppression BEFORE DELETE ON recovery_cases BEGIN SELECT RAISE(ABORT, 'recovery_cases ne se supprime pas'); END",
                "CREATE TRIGGER recovery_case_items_sans_suppression BEFORE DELETE ON recovery_case_items BEGIN SELECT RAISE(ABORT, 'recovery_case_items ne se supprime pas'); END",
                "CREATE TRIGGER recovery_acts_sans_suppression BEFORE DELETE ON recovery_acts BEGIN SELECT RAISE(ABORT, 'recovery_acts ne se supprime pas'); END",
                "CREATE TRIGGER recovery_bundles_sans_suppression BEFORE DELETE ON recovery_bundles BEGIN SELECT RAISE(ABORT, 'recovery_bundles ne se supprime pas'); END",
                "CREATE TRIGGER recovery_transmissions_sans_suppression BEFORE DELETE ON recovery_transmissions BEGIN SELECT RAISE(ABORT, 'recovery_transmissions ne se supprime pas'); END",
                "CREATE TRIGGER recovery_transmission_downloads_sans_suppression BEFORE DELETE ON recovery_transmission_downloads BEGIN SELECT RAISE(ABORT, 'recovery_transmission_downloads ne se supprime pas'); END",
                "CREATE TRIGGER recovery_acts_sans_modification BEFORE UPDATE ON recovery_acts BEGIN SELECT RAISE(ABORT, 'recovery_acts est figée après création'); END",
                "CREATE TRIGGER recovery_bundles_sans_modification BEFORE UPDATE ON recovery_bundles BEGIN SELECT RAISE(ABORT, 'recovery_bundles est figée après création'); END",
                "CREATE TRIGGER recovery_transmission_downloads_sans_modification BEFORE UPDATE ON recovery_transmission_downloads BEGIN SELECT RAISE(ABORT, 'recovery_transmission_downloads est figée après création'); END",
            ],
            'mysql', 'mariadb' => [
                "CREATE TRIGGER recovery_cases_sans_suppression BEFORE DELETE ON recovery_cases FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recovery_cases ne se supprime pas'",
                "CREATE TRIGGER recovery_case_items_sans_suppression BEFORE DELETE ON recovery_case_items FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recovery_case_items ne se supprime pas'",
                "CREATE TRIGGER recovery_acts_sans_suppression BEFORE DELETE ON recovery_acts FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recovery_acts ne se supprime pas'",
                "CREATE TRIGGER recovery_bundles_sans_suppression BEFORE DELETE ON recovery_bundles FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recovery_bundles ne se supprime pas'",
                "CREATE TRIGGER recovery_transmissions_sans_suppression BEFORE DELETE ON recovery_transmissions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recovery_transmissions ne se supprime pas'",
                "CREATE TRIGGER recovery_transmission_downloads_sans_suppression BEFORE DELETE ON recovery_transmission_downloads FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recovery_transmission_downloads ne se supprime pas'",
                "CREATE TRIGGER recovery_acts_sans_modification BEFORE UPDATE ON recovery_acts FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recovery_acts est figée après création'",
                "CREATE TRIGGER recovery_bundles_sans_modification BEFORE UPDATE ON recovery_bundles FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recovery_bundles est figée après création'",
                "CREATE TRIGGER recovery_transmission_downloads_sans_modification BEFORE UPDATE ON recovery_transmission_downloads FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recovery_transmission_downloads est figée après création'",
            ],
            default => throw new RuntimeException('Pilote de base sans verrou : '.DB::getDriverName()),
        };
    }
};
