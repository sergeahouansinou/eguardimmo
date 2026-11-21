<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\InsuranceRejectionReason;
use App\Modules\Leases\Enums\InsuranceSubmissionStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lease_insurance_submissions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->uuid('party_id');
            $table->uuid('stored_file_id');
            $table->text('insurer');
            $table->text('policy_number');
            $table->date('starts_on');
            $table->date('ends_on');
            $table->uuid('client_id');
            $table->string('status', 16);
            $table->string('rejection_reason', 24)->nullable();
            $table->text('note')->nullable();
            $table->uuid('decided_by_user_id')->nullable();
            $table->dateTime('decided_at', 6)->nullable();
            $table->uuid('certificate_id')->nullable();
            $table->string('pending_key', 73)->nullable()->virtualAs($this->pendingKey());
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['lease_id', 'party_id', 'client_id'], 'lease_insurance_client_unique');
            $table->unique('pending_key', 'lease_insurance_pending_unique');
            $table->index(['organization_id', 'lease_id', 'status'], 'lease_insurance_lease_idx');
            $table->index(['organization_id', 'status', 'created_at'], 'lease_insurance_queue_idx');
            $table->foreign(['organization_id', 'lease_id'])->references(['organization_id', 'id'])->on('leases');
        });

        Checks::add('lease_insurance_submissions', 'status', Checks::enum('status', InsuranceSubmissionStatus::class));
        Checks::add('lease_insurance_submissions', 'rejection_reason', Checks::enum('rejection_reason', InsuranceRejectionReason::class, nullable: true));

        Schema::create('lease_insurance_reminders', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->uuid('sent_by_user_id');
            $table->dateTime('sent_at', 6);
            $table->datetimes(6);

            $table->index(['organization_id', 'lease_id', 'sent_at'], 'lease_insurance_reminder_idx');
            $table->foreign(['organization_id', 'lease_id'])->references(['organization_id', 'id'])->on('leases');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lease_insurance_reminders');
        Schema::dropIfExists('lease_insurance_submissions');
    }

    private function pendingKey(): string
    {
        $concat = DB::getDriverName() === 'sqlite' ? "lease_id || '|' || party_id" : "CONCAT(lease_id, '|', party_id)";

        return "CASE WHEN status = 'pending' THEN {$concat} END";
    }
};
