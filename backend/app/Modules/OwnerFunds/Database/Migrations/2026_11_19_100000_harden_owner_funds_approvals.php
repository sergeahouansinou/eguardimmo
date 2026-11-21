<?php

declare(strict_types=1);

use App\Modules\OwnerFunds\Enums\TrustDepositStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payout_batches', function (Blueprint $table): void {
            $table->boolean('second_approver_required')->default(false);
            $table->unsignedSmallInteger('approvers_count')->default(0);
        });

        Schema::create('trust_deposit_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('status', 16);
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->date('executed_on');
            $table->string('bank_reference', 64);
            $table->boolean('second_approver_required')->default(false);
            $table->unsignedSmallInteger('approvers_count')->default(0);
            $table->uuid('requested_by_user_id')->nullable();
            $table->uuid('confirmed_by_user_id')->nullable();
            $table->dateTime('confirmed_at', 6)->nullable();
            $table->boolean('confirmed_solo')->default(false);
            $table->uuid('trust_transfer_id')->nullable();
            $table->string('idempotency_key', 120);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'idempotency_key']);
        });

        Checks::add('trust_deposit_requests', 'status', Checks::enum('status', TrustDepositStatus::class));
        Checks::add('trust_deposit_requests', 'amount', 'amount > 0');
    }

    public function down(): void
    {
        Schema::dropIfExists('trust_deposit_requests');
        Schema::table('payout_batches', function (Blueprint $table): void {
            $table->dropColumn(['second_approver_required', 'approvers_count']);
        });
    }
};
