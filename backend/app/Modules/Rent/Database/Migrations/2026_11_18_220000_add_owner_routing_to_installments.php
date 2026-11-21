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
        Schema::table('installments', function (Blueprint $table): void {
            $table->uuid('mandate_id')->nullable();
            $table->uuid('mandant_party_id')->nullable();
            $table->index(['organization_id', 'mandant_party_id']);
        });

        foreach ($this->declencheurs() as $instruction) {
            DB::unprepared($instruction);
        }
    }

    public function down(): void
    {
        Schema::table('installments', function (Blueprint $table): void {
            $table->dropIndex(['organization_id', 'mandant_party_id']);
            $table->dropColumn(['mandate_id', 'mandant_party_id']);
        });
    }

    /**
     * Le mandat et le mandant d'une échéance sont figés à l'émission : une fois posés, ils ne changent plus (ADR 0031).
     *
     * @return list<literal-string>
     */
    private function declencheurs(): array
    {
        return match (DB::getDriverName()) {
            'sqlite' => [
                "CREATE TRIGGER installments_mandant_fige BEFORE UPDATE ON installments
                    WHEN (OLD.mandate_id IS NOT NULL AND NEW.mandate_id IS NOT OLD.mandate_id)
                        OR (OLD.mandant_party_id IS NOT NULL AND NEW.mandant_party_id IS NOT OLD.mandant_party_id)
                    BEGIN SELECT RAISE(ABORT, 'le mandat d une echeance est fige'); END",
            ],
            'mysql', 'mariadb' => [
                "CREATE TRIGGER installments_mandant_fige BEFORE UPDATE ON installments FOR EACH ROW
                    BEGIN
                        IF (OLD.mandate_id IS NOT NULL AND NOT (NEW.mandate_id <=> OLD.mandate_id))
                            OR (OLD.mandant_party_id IS NOT NULL AND NOT (NEW.mandant_party_id <=> OLD.mandant_party_id)) THEN
                            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'le mandat d une echeance est fige';
                        END IF;
                    END",
            ],
            default => throw new RuntimeException('Pilote de base sans verrou du mandat : '.DB::getDriverName()),
        };
    }
};
