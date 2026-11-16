<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\Journal;
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
        Schema::create('journal_entry_counters', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->unsignedSmallInteger('fiscal_year');
            $table->unsignedInteger('last_value');

            $table->primary(['organization_id', 'fiscal_year']);
        });

        Schema::create('journal_entries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->unsignedSmallInteger('fiscal_year');
            $table->unsignedInteger('number');
            $table->string('journal', 16);
            $table->date('entry_date');
            $table->string('label', 255);
            $table->string('source_type', 32);
            $table->uuid('source_id');
            $table->string('idempotency_key', 120);
            $table->char('fingerprint', 64);
            $table->uuid('reversal_of_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'fiscal_year', 'number']);
            $table->unique(['organization_id', 'idempotency_key']);
            $table->unique(['organization_id', 'reversal_of_id']);
            $table->index(['organization_id', 'entry_date', 'id']);
            $table->index(['organization_id', 'source_type', 'source_id']);
            $table->foreign(['organization_id', 'reversal_of_id'])->references(['organization_id', 'id'])->on('journal_entries');
        });

        Schema::create('journal_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('journal_entry_id');
            $table->unsignedSmallInteger('position');
            $table->uuid('account_id');
            $table->unsignedBigInteger('debit');
            $table->unsignedBigInteger('credit');
            $table->char('currency', 3);
            $table->uuid('lease_id')->nullable();
            $table->uuid('party_id')->nullable();
            $table->uuid('unit_id')->nullable();
            $table->string('item_type', 24)->nullable();
            $table->uuid('item_id')->nullable();
            $table->datetimes(6);

            $table->unique(['journal_entry_id', 'position']);
            $table->index(['organization_id', 'account_id']);
            $table->index(['organization_id', 'account_id', 'lease_id']);
            $table->index(['organization_id', 'account_id', 'party_id']);
            $table->index(['organization_id', 'item_type', 'item_id']);
            $table->foreign(['organization_id', 'journal_entry_id'])->references(['organization_id', 'id'])->on('journal_entries');
            $table->foreign(['organization_id', 'account_id'])->references(['organization_id', 'id'])->on('accounts');
        });

        Checks::add('journal_entries', 'journal', Checks::enum('journal', Journal::class));
        Checks::add('journal_entries', 'source_type', Checks::enum('source_type', SourceType::class));
        Checks::add('journal_lines', 'amount', '(debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)');
        Checks::add('journal_lines', 'currency', Checks::uppercase('currency', 3));
        Checks::add('journal_lines', 'item', '(item_type IS NULL) = (item_id IS NULL)');
        Checks::add('journal_lines', 'item_type', Checks::enum('item_type', ItemType::class, nullable: true));

        foreach (['journal_entries', 'journal_lines'] as $table) {
            foreach ($this->verrous($table) as $instruction) {
                DB::unprepared($instruction);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_lines');
        Schema::dropIfExists('journal_entries');
        Schema::dropIfExists('journal_entry_counters');
    }

    /**
     * @param  literal-string  $table
     * @return list<literal-string>
     */
    private function verrous(string $table): array
    {
        $message = "{$table} est en ajout seul";

        return match (DB::getDriverName()) {
            'sqlite' => [
                "CREATE TRIGGER {$table}_sans_modification BEFORE UPDATE ON {$table} BEGIN SELECT RAISE(ABORT, '{$message}'); END",
                "CREATE TRIGGER {$table}_sans_suppression BEFORE DELETE ON {$table} BEGIN SELECT RAISE(ABORT, '{$message}'); END",
            ],
            'mysql', 'mariadb' => [
                "CREATE TRIGGER {$table}_sans_modification BEFORE UPDATE ON {$table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$message}'",
                "CREATE TRIGGER {$table}_sans_suppression BEFORE DELETE ON {$table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$message}'",
            ],
            default => throw new RuntimeException('Pilote de base sans verrou du grand livre : '.DB::getDriverName()),
        };
    }
};
