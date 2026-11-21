<?php

declare(strict_types=1);

use App\Modules\OwnerFunds\Enums\HoldReason;
use App\Modules\OwnerFunds\Enums\PayoutAccountRequestStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payout_account_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('mandant_party_id');
            $table->uuid('access_id');
            $table->uuid('requested_by_user_id');
            $table->uuid('bank_account_id');
            $table->uuid('proof_file_id');
            $table->string('status', 16);
            $table->char('code_hash', 64)->nullable();
            $table->unsignedSmallInteger('code_attempts')->default(0);
            $table->uuid('decided_by_user_id')->nullable();
            $table->dateTime('decided_at', 6)->nullable();
            $table->string('reject_reason', 500)->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->string('live_key', 36)->nullable()->virtualAs("CASE WHEN status IN ('awaiting_code', 'pending') THEN mandant_party_id END");
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'live_key']);
            $table->index(['organization_id', 'mandant_party_id', 'status'], 'payout_account_requests_org_mandant_status_index');
            $table->index(['organization_id', 'status', 'created_at']);
        });

        Checks::add('payout_account_requests', 'status', Checks::enum('status', PayoutAccountRequestStatus::class));

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE payout_holds DROP CONSTRAINT payout_holds_reason_check');
        }

        Checks::add('payout_holds', 'reason', Checks::enum('reason', HoldReason::class));
    }

    /**
     * Échoue en MySQL tant qu'une retenue `account_change_contested` existe : la contrainte d'origine ne l'admet pas, on ne l'efface pas.
     */
    public function down(): void
    {
        Schema::dropIfExists('payout_account_requests');

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE payout_holds DROP CONSTRAINT payout_holds_reason_check');
        }

        Checks::add('payout_holds', 'reason', "reason IN ('dispute', 'mandate_ending', 'works_reserve', 'succession', 'other')");
    }
};
