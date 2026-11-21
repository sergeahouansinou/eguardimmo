<?php

declare(strict_types=1);

use App\Modules\Maintenance\Enums\ApprovalDecision;
use App\Modules\Maintenance\Enums\ProofMethod;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const array DECLENCHEURS = [
        ['approval_evidences_sans_modification', 'BEFORE UPDATE', 'approval_evidences_est_en_ajout_seul'],
        ['approval_evidences_sans_suppression', 'BEFORE DELETE', 'approval_evidences_est_en_ajout_seul'],
    ];

    public function up(): void
    {
        Schema::create('approval_evidences', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('intervention_id');
            $table->uuid('approval_id');
            $table->uuid('quote_id')->nullable();
            $table->uuid('mandant_party_id');
            $table->uuid('access_id');
            $table->uuid('user_id');
            $table->string('decision', 8);
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->char('fingerprint', 64);
            $table->char('quote_fingerprint', 64);
            $table->string('statement_version', 32);
            $table->text('payload');
            $table->string('proof_method', 16);
            $table->dateTime('proof_at', 6);
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->string('idempotency_key', 64);
            $table->dateTime('decided_at', 6);
            $table->dateTime('created_at', 6);

            $table->unique(['organization_id', 'user_id', 'idempotency_key'], 'approval_evidences_org_user_idem_unique');
            $table->index(['approval_id', 'decided_at']);
            $table->foreign(['organization_id', 'intervention_id'])->references(['organization_id', 'id'])->on('interventions');
            $table->foreign(['organization_id', 'approval_id'])->references(['organization_id', 'id'])->on('intervention_approvals');
        });

        Checks::add('approval_evidences', 'decision', Checks::enum('decision', ApprovalDecision::class));
        Checks::add('approval_evidences', 'proof_method', Checks::enum('proof_method', ProofMethod::class));

        foreach ($this->declencheurs() as $instruction) {
            DB::statement($instruction);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_evidences');
    }

    /**
     * @return list<string>
     */
    private function declencheurs(): array
    {
        $sqlite = DB::getDriverName() === 'sqlite';

        if (! $sqlite && ! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            throw new RuntimeException('Pilote de base sans verrou : '.DB::getDriverName());
        }

        return array_map(fn (array $r): string => $sqlite
            ? "CREATE TRIGGER {$r[0]} {$r[1]} ON approval_evidences FOR EACH ROW BEGIN SELECT RAISE(ABORT, '{$r[2]}'); END"
            : "CREATE TRIGGER {$r[0]} {$r[1]} ON approval_evidences FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$r[2]}'", self::DECLENCHEURS);
    }
};
