<?php

declare(strict_types=1);

use App\Modules\OwnerFunds\Enums\ExclusionReason;
use App\Modules\OwnerFunds\Enums\HoldKind;
use App\Modules\OwnerFunds\Enums\HoldReason;
use App\Modules\OwnerFunds\Enums\PayoutBatchStatus;
use App\Modules\OwnerFunds\Enums\PayoutItemStatus;
use App\Modules\OwnerFunds\Enums\TrustTransferDirection;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('owner_funds_sequences', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->unsignedSmallInteger('fiscal_year');
            $table->unsignedInteger('last_value');

            $table->primary(['organization_id', 'fiscal_year']);
        });

        Schema::create('owner_funds_idempotency_keys', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('idempotency_key', 120);
            $table->char('fingerprint', 64);
            $table->string('subject_type', 32);
            $table->uuid('subject_id');
            $table->datetimes(6);

            $table->unique(['organization_id', 'idempotency_key'], 'owner_funds_idempotency_keys_org_key_unique');
        });

        Schema::create('fee_statements', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('mandate_id');
            $table->uuid('mandant_party_id');
            $table->date('period_start');
            $table->date('period_end');
            $table->char('currency', 3);
            $table->bigInteger('base_rent');
            $table->bigInteger('base_charges');
            $table->string('fee_kind', 16)->nullable();
            $table->unsignedInteger('rate_bp')->nullable();
            $table->unsignedBigInteger('flat_amount')->nullable();
            $table->unsignedBigInteger('minimum_amount')->default(0);
            $table->string('fee_tax_mode', 16)->nullable();
            $table->json('term_ids');
            $table->bigInteger('fee_net');
            $table->bigInteger('tax_amount');
            $table->bigInteger('fee_total');
            $table->boolean('minimum_applied')->default(false);
            $table->bigInteger('carried_net')->default(0);
            $table->uuid('invoice_id')->nullable();
            $table->uuid('credit_note_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'mandate_id', 'period_start']);
            $table->index(['organization_id', 'mandant_party_id', 'period_start'], 'fee_statements_org_mandant_period_index');
        });

        Schema::create('payout_batches', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('number', 20)->nullable();
            $table->string('status', 16);
            $table->char('currency', 3);
            $table->date('execution_on')->nullable();
            $table->string('idempotency_key', 120);
            $table->char('fingerprint', 64);
            $table->unsignedInteger('lock_version')->default(1);
            $table->dateTime('validated_at', 6)->nullable();
            $table->uuid('validated_by_user_id')->nullable();
            $table->dateTime('cancelled_at', 6)->nullable();
            $table->string('cancel_reason', 500)->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'idempotency_key']);
            $table->unique(['organization_id', 'number']);
        });

        Schema::create('payout_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('batch_id');
            $table->uuid('mandant_party_id');
            $table->string('status', 16);
            $table->string('exclusion_reason', 32)->nullable();
            $table->unsignedBigInteger('net_amount');
            $table->unsignedBigInteger('fees_settled_amount')->default(0);
            $table->char('currency', 3);
            $table->uuid('bank_account_id')->nullable();
            $table->char('bank_last4', 4)->nullable();
            $table->uuid('transit_entry_id')->nullable();
            $table->uuid('execution_entry_id')->nullable();
            $table->uuid('return_entry_id')->nullable();
            $table->date('executed_on')->nullable();
            $table->string('bank_reference', 64)->nullable();
            $table->uuid('validated_by_user_id')->nullable();
            $table->uuid('executed_by_user_id')->nullable();
            $table->boolean('executed_solo')->default(false);
            $table->string('failure_reason', 500)->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->string('open_key', 36)->nullable()->virtualAs("CASE WHEN status IN ('included', 'pending') THEN mandant_party_id END");
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'open_key']);
            $table->index(['organization_id', 'batch_id']);
            $table->index(['organization_id', 'mandant_party_id']);
            $table->foreign(['organization_id', 'batch_id'])->references(['organization_id', 'id'])->on('payout_batches');
        });

        Schema::create('payout_holds', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('mandant_party_id');
            $table->string('kind', 16);
            $table->unsignedBigInteger('amount')->nullable();
            $table->char('currency', 3);
            $table->string('reason', 24);
            $table->string('comment', 500)->nullable();
            $table->uuid('placed_by_user_id')->nullable();
            $table->dateTime('released_at', 6)->nullable();
            $table->uuid('released_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'mandant_party_id', 'released_at']);
        });

        Schema::create('trust_transfers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('direction', 16);
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->date('executed_on');
            $table->string('bank_reference', 64)->nullable();
            $table->uuid('ledger_entry_id');
            $table->uuid('created_by_user_id')->nullable();
            $table->string('idempotency_key', 120);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'idempotency_key']);
        });

        Checks::add('fee_statements', 'period', 'DAYOFMONTH(period_start) = 1 AND period_end = DATE_ADD(period_start, INTERVAL 1 MONTH)');
        Checks::add('fee_statements', 'currency', Checks::uppercase('currency', 3));
        Checks::add('payout_batches', 'status', Checks::enum('status', PayoutBatchStatus::class));
        Checks::add('payout_items', 'status', Checks::enum('status', PayoutItemStatus::class));
        Checks::add('payout_items', 'exclusion_reason', Checks::enum('exclusion_reason', ExclusionReason::class, nullable: true));
        Checks::add('payout_items', 'exclusion', "(status = 'excluded') = (exclusion_reason IS NOT NULL)");
        Checks::add('payout_items', 'net_amount', "status NOT IN ('pending', 'paid') OR net_amount > 0");
        Checks::add('payout_holds', 'kind', Checks::enum('kind', HoldKind::class));
        Checks::add('payout_holds', 'reason', Checks::enum('reason', HoldReason::class));
        Checks::add('payout_holds', 'amount', "(kind = 'full' AND amount IS NULL) OR (kind = 'reserve' AND amount > 0)");
        Checks::add('trust_transfers', 'direction', Checks::enum('direction', TrustTransferDirection::class));
        Checks::add('trust_transfers', 'amount', 'amount > 0');

        foreach ($this->declencheurs() as $instruction) {
            DB::unprepared($instruction);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('trust_transfers');
        Schema::dropIfExists('payout_holds');
        Schema::dropIfExists('payout_items');
        Schema::dropIfExists('payout_batches');
        Schema::dropIfExists('fee_statements');
        Schema::dropIfExists('owner_funds_idempotency_keys');
        Schema::dropIfExists('owner_funds_sequences');
    }

    /**
     * @return list<literal-string>
     */
    private function declencheurs(): array
    {
        return match (DB::getDriverName()) {
            'sqlite' => [
                "CREATE TRIGGER fee_statements_sans_modification BEFORE UPDATE ON fee_statements BEGIN SELECT RAISE(ABORT, 'fee_statements est en ajout seul'); END",
                "CREATE TRIGGER fee_statements_sans_suppression BEFORE DELETE ON fee_statements BEGIN SELECT RAISE(ABORT, 'fee_statements est en ajout seul'); END",
                "CREATE TRIGGER payout_batches_sans_suppression BEFORE DELETE ON payout_batches BEGIN SELECT RAISE(ABORT, 'payout_batches ne se supprime pas'); END",
                "CREATE TRIGGER payout_batches_numero_fige BEFORE UPDATE ON payout_batches WHEN OLD.number IS NOT NULL AND NEW.number IS NOT OLD.number BEGIN SELECT RAISE(ABORT, 'le numero du lot est fige'); END",
                "CREATE TRIGGER payout_items_sans_suppression BEFORE DELETE ON payout_items BEGIN SELECT RAISE(ABORT, 'payout_items ne se supprime pas'); END",
                "CREATE TRIGGER payout_items_fige BEFORE UPDATE ON payout_items WHEN OLD.status IN ('pending', 'paid', 'failed', 'returned') AND (NEW.mandant_party_id <> OLD.mandant_party_id OR NEW.net_amount <> OLD.net_amount OR NEW.bank_account_id IS NOT OLD.bank_account_id) BEGIN SELECT RAISE(ABORT, 'un reversement valide ne change ni mandant, ni montant, ni compte'); END",
                "CREATE TRIGGER payout_items_statut_terminal BEFORE UPDATE ON payout_items WHEN (OLD.status IN ('failed', 'returned') AND NEW.status <> OLD.status) OR (OLD.status = 'paid' AND NEW.status NOT IN ('paid', 'returned')) BEGIN SELECT RAISE(ABORT, 'statut de reversement terminal'); END",
                "CREATE TRIGGER payout_holds_sans_suppression BEFORE DELETE ON payout_holds BEGIN SELECT RAISE(ABORT, 'payout_holds ne se supprime pas'); END",
                "CREATE TRIGGER payout_holds_figee BEFORE UPDATE ON payout_holds WHEN OLD.released_at IS NOT NULL OR NEW.mandant_party_id <> OLD.mandant_party_id OR NEW.kind <> OLD.kind OR NEW.amount IS NOT OLD.amount OR NEW.reason <> OLD.reason BEGIN SELECT RAISE(ABORT, 'une retenue ne se modifie pas : levez-la'); END",
                "CREATE TRIGGER trust_transfers_sans_modification BEFORE UPDATE ON trust_transfers BEGIN SELECT RAISE(ABORT, 'trust_transfers est en ajout seul'); END",
                "CREATE TRIGGER trust_transfers_sans_suppression BEFORE DELETE ON trust_transfers BEGIN SELECT RAISE(ABORT, 'trust_transfers est en ajout seul'); END",
            ],
            'mysql', 'mariadb' => [
                "CREATE TRIGGER fee_statements_sans_modification BEFORE UPDATE ON fee_statements FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fee_statements est en ajout seul'",
                "CREATE TRIGGER fee_statements_sans_suppression BEFORE DELETE ON fee_statements FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fee_statements est en ajout seul'",
                "CREATE TRIGGER payout_batches_sans_suppression BEFORE DELETE ON payout_batches FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'payout_batches ne se supprime pas'",
                "CREATE TRIGGER payout_batches_numero_fige BEFORE UPDATE ON payout_batches FOR EACH ROW IF OLD.number IS NOT NULL AND NOT (NEW.number <=> OLD.number) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'le numero du lot est fige'; END IF",
                "CREATE TRIGGER payout_items_sans_suppression BEFORE DELETE ON payout_items FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'payout_items ne se supprime pas'",
                "CREATE TRIGGER payout_items_fige BEFORE UPDATE ON payout_items FOR EACH ROW IF OLD.status IN ('pending', 'paid', 'failed', 'returned') AND (NEW.mandant_party_id <> OLD.mandant_party_id OR NEW.net_amount <> OLD.net_amount OR NOT (NEW.bank_account_id <=> OLD.bank_account_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'un reversement valide ne change ni mandant, ni montant, ni compte'; END IF",
                "CREATE TRIGGER payout_items_statut_terminal BEFORE UPDATE ON payout_items FOR EACH ROW IF (OLD.status IN ('failed', 'returned') AND NEW.status <> OLD.status) OR (OLD.status = 'paid' AND NEW.status NOT IN ('paid', 'returned')) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'statut de reversement terminal'; END IF",
                "CREATE TRIGGER payout_holds_sans_suppression BEFORE DELETE ON payout_holds FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'payout_holds ne se supprime pas'",
                "CREATE TRIGGER payout_holds_figee BEFORE UPDATE ON payout_holds FOR EACH ROW IF OLD.released_at IS NOT NULL OR NEW.mandant_party_id <> OLD.mandant_party_id OR NEW.kind <> OLD.kind OR NOT (NEW.amount <=> OLD.amount) OR NEW.reason <> OLD.reason THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'une retenue ne se modifie pas : levez-la'; END IF",
                "CREATE TRIGGER trust_transfers_sans_modification BEFORE UPDATE ON trust_transfers FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'trust_transfers est en ajout seul'",
                "CREATE TRIGGER trust_transfers_sans_suppression BEFORE DELETE ON trust_transfers FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'trust_transfers est en ajout seul'",
            ],
            default => throw new RuntimeException('Pilote de base sans déclencheurs OwnerFunds : '.DB::getDriverName()),
        };
    }
};
