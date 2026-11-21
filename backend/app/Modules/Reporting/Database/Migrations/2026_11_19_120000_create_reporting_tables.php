<?php

declare(strict_types=1);

use App\Modules\Reporting\Enums\LineDirection;
use App\Modules\Reporting\Enums\LineKind;
use App\Modules\Reporting\Enums\PeriodKind;
use App\Modules\Reporting\Enums\ReportStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const array FIGEES = [
        'organization_id', 'mandant_party_id', 'number', 'period_kind', 'period_start', 'period_end', 'currency', 'content', 'options',
        'collected_total', 'fees_total', 'works_total', 'payout_total', 'adjustments_total', 'opening_balance', 'closing_balance',
        'snapshot', 'ledger_cutoff', 'fingerprint', 'template_version', 'issued_document_id', 'stored_file_id', 'supersedes_id',
        'rectification_reason', 'scheduled_for', 'notify', 'generated_at', 'published_at', 'published_by_user_id', 'idempotency_key',
        'request_hash', 'created_by_user_id', 'created_at',
    ];

    public function up(): void
    {
        Schema::create('management_report_sequences', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('last_value');

            $table->primary(['organization_id', 'year']);
        });

        Schema::create('reporting_mandant_locks', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('mandant_party_id');

            $table->primary(['organization_id', 'mandant_party_id']);
        });

        Schema::create('management_reports', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('mandant_party_id');
            $table->string('number', 20)->nullable();
            $table->string('period_kind', 16);
            $table->date('period_start');
            $table->date('period_end');
            $table->string('status', 16);
            $table->char('currency', 3);
            $table->json('content');
            $table->json('options');
            $table->bigInteger('collected_total')->nullable();
            $table->bigInteger('fees_total')->nullable();
            $table->bigInteger('works_total')->nullable();
            $table->bigInteger('payout_total')->nullable();
            $table->bigInteger('adjustments_total')->nullable();
            $table->bigInteger('opening_balance')->nullable();
            $table->bigInteger('closing_balance')->nullable();
            $table->json('snapshot')->nullable();
            $table->json('ledger_cutoff')->nullable();
            $table->char('fingerprint', 64)->nullable();
            $table->string('template_version', 16)->nullable();
            $table->uuid('issued_document_id')->nullable();
            $table->uuid('stored_file_id')->nullable();
            $table->uuid('supersedes_id')->nullable();
            $table->string('rectification_reason', 500)->nullable();
            $table->dateTime('scheduled_for', 6)->nullable();
            $table->boolean('notify')->default(true);
            $table->dateTime('generated_at', 6)->nullable();
            $table->dateTime('published_at', 6)->nullable();
            $table->uuid('published_by_user_id')->nullable();
            $table->dateTime('first_read_at', 6)->nullable();
            $table->string('idempotency_key', 120);
            $table->char('request_hash', 64);
            $table->unsignedInteger('lock_version')->default(1);
            $table->uuid('created_by_user_id')->nullable();
            $table->string('open_key', 64)->nullable()->virtualAs($this->openKey());
            $table->uuid('rectification_key')->nullable()->virtualAs("CASE WHEN supersedes_id IS NOT NULL AND status IN ('draft', 'generated') THEN supersedes_id END");
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'number']);
            $table->unique(['organization_id', 'idempotency_key']);
            $table->unique(['organization_id', 'open_key']);
            $table->unique(['organization_id', 'rectification_key']);
            $table->index(['organization_id', 'mandant_party_id', 'period_start'], 'management_reports_org_mandant_period_index');
            $table->index(['organization_id', 'status', 'period_start']);
            $table->foreign(['organization_id', 'supersedes_id'])->references(['organization_id', 'id'])->on('management_reports');
        });

        Schema::create('management_report_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('report_id');
            $table->unsignedInteger('position');
            $table->string('kind', 16);
            $table->date('entry_date');
            $table->uuid('unit_id')->nullable();
            $table->uuid('lease_id')->nullable();
            $table->uuid('mandate_id')->nullable();
            $table->string('label', 255);
            $table->unsignedBigInteger('amount');
            $table->string('direction', 8);
            $table->string('source_type', 32)->nullable();
            $table->uuid('source_id')->nullable();
            $table->datetimes(6);

            $table->unique(['report_id', 'position']);
            $table->index(['organization_id', 'report_id']);
            $table->foreign(['organization_id', 'report_id'])->references(['organization_id', 'id'])->on('management_reports');
        });

        Checks::add('management_reports', 'status', Checks::enum('status', ReportStatus::class));
        Checks::add('management_reports', 'period_kind', Checks::enum('period_kind', PeriodKind::class));
        Checks::add('management_reports', 'currency', Checks::uppercase('currency', 3));
        Checks::add('management_reports', 'period', 'period_end > period_start AND period_end <= DATE_ADD(period_start, INTERVAL 12 MONTH)');
        Checks::add('management_reports', 'number', "status NOT IN ('published', 'superseded') OR number IS NOT NULL");
        Checks::add('management_reports', 'figures', "status IN ('draft', 'discarded') OR (snapshot IS NOT NULL AND fingerprint IS NOT NULL AND closing_balance IS NOT NULL)");
        Checks::add('management_report_lines', 'kind', Checks::enum('kind', LineKind::class));
        Checks::add('management_report_lines', 'direction', Checks::enum('direction', LineDirection::class));

        foreach ($this->declencheurs() as $instruction) {
            DB::unprepared($instruction);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('management_report_lines');
        Schema::dropIfExists('management_reports');
        Schema::dropIfExists('reporting_mandant_locks');
        Schema::dropIfExists('management_report_sequences');
    }

    private function openKey(): string
    {
        $concat = DB::getDriverName() === 'sqlite' ? "mandant_party_id || '|' || period_start || '|' || period_end" : "CONCAT(mandant_party_id, '|', period_start, '|', period_end)";

        return "CASE WHEN supersedes_id IS NULL AND status IN ('draft', 'generated', 'published') THEN {$concat} END";
    }

    /**
     * @return list<literal-string>
     */
    private function declencheurs(): array
    {
        $sqlite = DB::getDriverName() === 'sqlite';
        $changement = 'FALSE';

        foreach (self::FIGEES as $colonne) {
            $changement .= $sqlite ? " OR NEW.{$colonne} IS NOT OLD.{$colonne}" : " OR NOT (NEW.{$colonne} <=> OLD.{$colonne})";
        }

        $statut = "NEW.status NOT IN ('published', 'superseded') OR (OLD.status = 'superseded' AND NEW.status <> 'superseded')";

        return match (DB::getDriverName()) {
            'sqlite' => [
                "CREATE TRIGGER management_reports_figee BEFORE UPDATE ON management_reports WHEN OLD.published_at IS NOT NULL AND ({$changement} OR {$statut}) BEGIN SELECT RAISE(ABORT, 'un compte rendu publie est immuable : passez un rectificatif'); END",
                "CREATE TRIGGER management_reports_sans_suppression BEFORE DELETE ON management_reports BEGIN SELECT RAISE(ABORT, 'un compte rendu ne se supprime pas'); END",
                "CREATE TRIGGER management_report_lines_figees_ajout BEFORE INSERT ON management_report_lines WHEN (SELECT published_at FROM management_reports WHERE id = NEW.report_id) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'les lignes d un compte rendu publie sont immuables'); END",
                "CREATE TRIGGER management_report_lines_figees_modification BEFORE UPDATE ON management_report_lines WHEN (SELECT published_at FROM management_reports WHERE id = OLD.report_id) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'les lignes d un compte rendu publie sont immuables'); END",
                "CREATE TRIGGER management_report_lines_figees_suppression BEFORE DELETE ON management_report_lines WHEN (SELECT published_at FROM management_reports WHERE id = OLD.report_id) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'les lignes d un compte rendu publie sont immuables'); END",
            ],
            'mysql', 'mariadb' => [
                "CREATE TRIGGER management_reports_figee BEFORE UPDATE ON management_reports FOR EACH ROW IF OLD.published_at IS NOT NULL AND ({$changement} OR {$statut}) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'un compte rendu publie est immuable : passez un rectificatif'; END IF",
                "CREATE TRIGGER management_reports_sans_suppression BEFORE DELETE ON management_reports FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'un compte rendu ne se supprime pas'",
                "CREATE TRIGGER management_report_lines_figees_ajout BEFORE INSERT ON management_report_lines FOR EACH ROW IF EXISTS (SELECT 1 FROM management_reports WHERE id = NEW.report_id AND published_at IS NOT NULL) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'les lignes d un compte rendu publie sont immuables'; END IF",
                "CREATE TRIGGER management_report_lines_figees_modification BEFORE UPDATE ON management_report_lines FOR EACH ROW IF EXISTS (SELECT 1 FROM management_reports WHERE id = OLD.report_id AND published_at IS NOT NULL) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'les lignes d un compte rendu publie sont immuables'; END IF",
                "CREATE TRIGGER management_report_lines_figees_suppression BEFORE DELETE ON management_report_lines FOR EACH ROW IF EXISTS (SELECT 1 FROM management_reports WHERE id = OLD.report_id AND published_at IS NOT NULL) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'les lignes d un compte rendu publie sont immuables'; END IF",
            ],
            default => throw new RuntimeException('Pilote de base sans déclencheurs Reporting : '.DB::getDriverName()),
        };
    }
};
