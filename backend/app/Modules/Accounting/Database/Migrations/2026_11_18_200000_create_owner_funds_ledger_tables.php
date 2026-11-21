<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\SourceType;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounting_periods', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->date('period_start');
            $table->date('period_end');
            $table->dateTime('closed_at', 6);
            $table->uuid('closed_by_user_id')->nullable();
            $table->json('closing_cutoff');
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'period_start']);
        });

        Schema::create('accounting_period_locks', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->primary()->constrained('organizations');
            $table->unsignedInteger('last_value')->default(0);
        });

        Schema::create('ledger_party_locks', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('party_id');
            $table->unsignedInteger('last_value')->default(0);

            $table->primary(['organization_id', 'party_id']);
        });

        Schema::create('accounting_settings', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->primary()->constrained('organizations');
            $table->dateTime('owner_funds_cutover_at', 6)->nullable();
            $table->datetimes(6);
        });

        Checks::add('accounting_periods', 'start', 'DAYOFMONTH(period_start) = 1');
        Checks::add('accounting_periods', 'end', 'period_end = DATE_ADD(period_start, INTERVAL 1 MONTH)');

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            foreach ([['accounts', 'role', Checks::enum('role', AccountRole::class)], ['journal_entries', 'source_type', Checks::enum('source_type', SourceType::class)]] as [$table, $nom, $expression]) {
                DB::statement("ALTER TABLE {$table} DROP CHECK {$table}_{$nom}_check");
                Checks::add($table, $nom, $expression);
            }
        }

        foreach ($this->declencheurs() as $instruction) {
            DB::unprepared($instruction);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_settings');
        Schema::dropIfExists('ledger_party_locks');
        Schema::dropIfExists('accounting_period_locks');
        Schema::dropIfExists('accounting_periods');
    }

    /**
     * @return list<literal-string>
     */
    private function declencheurs(): array
    {
        return match (DB::getDriverName()) {
            'sqlite' => [
                "CREATE TRIGGER accounting_periods_sans_modification BEFORE UPDATE ON accounting_periods BEGIN SELECT RAISE(ABORT, 'accounting_periods est en ajout seul'); END",
                "CREATE TRIGGER accounting_periods_sans_suppression BEFORE DELETE ON accounting_periods BEGIN SELECT RAISE(ABORT, 'accounting_periods est en ajout seul'); END",
                "CREATE TRIGGER accounting_periods_sequentielle BEFORE INSERT ON accounting_periods
                    WHEN EXISTS (SELECT 1 FROM accounting_periods p WHERE p.organization_id = NEW.organization_id)
                        AND NEW.period_start <> (SELECT MAX(p.period_end) FROM accounting_periods p WHERE p.organization_id = NEW.organization_id)
                    BEGIN SELECT RAISE(ABORT, 'un mois clos suit le dernier mois clos'); END",
                "CREATE TRIGGER journal_entries_periode_close BEFORE INSERT ON journal_entries
                    WHEN EXISTS (SELECT 1 FROM accounting_periods p WHERE p.organization_id = NEW.organization_id AND p.period_end > NEW.entry_date)
                    BEGIN SELECT RAISE(ABORT, 'periode comptable close'); END",
                "CREATE TRIGGER journal_lines_periode_close BEFORE INSERT ON journal_lines
                    WHEN EXISTS (SELECT 1 FROM journal_entries e JOIN accounting_periods p ON p.organization_id = e.organization_id WHERE e.id = NEW.journal_entry_id AND p.period_end > e.entry_date)
                    BEGIN SELECT RAISE(ABORT, 'periode comptable close'); END",
            ],
            'mysql', 'mariadb' => [
                "CREATE TRIGGER accounting_periods_sans_modification BEFORE UPDATE ON accounting_periods FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'accounting_periods est en ajout seul'",
                "CREATE TRIGGER accounting_periods_sans_suppression BEFORE DELETE ON accounting_periods FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'accounting_periods est en ajout seul'",
                "CREATE TRIGGER accounting_periods_sequentielle BEFORE INSERT ON accounting_periods FOR EACH ROW
                    BEGIN
                        IF EXISTS (SELECT 1 FROM accounting_periods p WHERE p.organization_id = NEW.organization_id)
                            AND NEW.period_start <> (SELECT MAX(p.period_end) FROM accounting_periods p WHERE p.organization_id = NEW.organization_id) THEN
                            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'un mois clos suit le dernier mois clos';
                        END IF;
                    END",
                "CREATE TRIGGER journal_entries_periode_close BEFORE INSERT ON journal_entries FOR EACH ROW
                    BEGIN
                        IF EXISTS (SELECT 1 FROM accounting_periods p WHERE p.organization_id = NEW.organization_id AND p.period_end > NEW.entry_date) THEN
                            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'periode comptable close';
                        END IF;
                    END",
                "CREATE TRIGGER journal_lines_periode_close BEFORE INSERT ON journal_lines FOR EACH ROW
                    BEGIN
                        IF EXISTS (SELECT 1 FROM journal_entries e JOIN accounting_periods p ON p.organization_id = e.organization_id WHERE e.id = NEW.journal_entry_id AND p.period_end > e.entry_date) THEN
                            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'periode comptable close';
                        END IF;
                    END",
            ],
            default => throw new RuntimeException('Pilote de base sans verrou des périodes : '.DB::getDriverName()),
        };
    }
};
