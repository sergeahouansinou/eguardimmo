<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->timestamp('occurred_at', 6);
            $table->string('action', 100);
            $table->uuid('actor_user_id')->nullable();
            $table->uuid('organization_id')->nullable();
            $table->string('subject_type', 50)->nullable();
            $table->uuid('subject_id')->nullable();
            $table->json('changes')->nullable();
            $table->json('metadata');
            $table->uuid('request_id')->nullable()->index();
            $table->string('route', 150)->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent')->nullable();

            $table->index('occurred_at');
            $table->index(['action', 'occurred_at']);
            $table->index(['actor_user_id', 'occurred_at']);
            $table->index(['organization_id', 'occurred_at']);
            $table->index(['subject_type', 'subject_id', 'occurred_at']);
        });

        foreach ($this->verrous() as $instruction) {
            DB::unprepared($instruction);
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared('DROP FUNCTION IF EXISTS audit_logs_ajout_seul() CASCADE');
        }

        Schema::dropIfExists('audit_logs');
    }

    /**
     * @return list<literal-string>
     */
    private function verrous(): array
    {
        $message = 'audit_logs est en ajout seul';

        return match (DB::getDriverName()) {
            'pgsql' => [
                "CREATE FUNCTION audit_logs_ajout_seul() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '{$message}'; END $$",
                'CREATE TRIGGER audit_logs_sans_modification BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_ajout_seul()',
                'CREATE TRIGGER audit_logs_sans_vidage BEFORE TRUNCATE ON audit_logs FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_ajout_seul()',
            ],
            'sqlite' => [
                "CREATE TRIGGER audit_logs_sans_modification BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT, '{$message}'); END",
                "CREATE TRIGGER audit_logs_sans_suppression BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT, '{$message}'); END",
            ],
            'mysql', 'mariadb' => [
                "CREATE TRIGGER audit_logs_sans_modification BEFORE UPDATE ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$message}'",
                "CREATE TRIGGER audit_logs_sans_suppression BEFORE DELETE ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$message}'",
            ],
            default => throw new RuntimeException('Pilote de base sans verrou du journal d\'audit : '.DB::getDriverName()),
        };
    }
};
