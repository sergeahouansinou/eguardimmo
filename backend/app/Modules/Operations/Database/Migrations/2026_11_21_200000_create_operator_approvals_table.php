<?php

declare(strict_types=1);

use App\Modules\Operations\Enums\ApprovableAction;
use App\Modules\Operations\Enums\ApprovalStatus;
use App\Shared\Database\Checks;
use App\Shared\Database\RowGuards;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $vivante = in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)
            ? "CASE WHEN status = 'pending' THEN CONCAT(action, ':', subject_id) END"
            : "CASE WHEN status = 'pending' THEN action || ':' || subject_id END";

        Schema::create('operator_approvals', function (Blueprint $table) use ($vivante): void {
            $table->uuid('id')->primary();
            $table->string('action', 40);
            $table->string('subject_type', 40);
            $table->uuid('subject_id');
            $table->uuid('organization_id')->nullable();
            $table->json('payload');
            $table->text('reason');
            $table->string('ticket_reference', 40)->nullable();
            $table->foreignUuid('requested_by_user_id')->constrained('users');
            $table->string('requested_proof', 16);
            $table->string('status', 16);
            $table->foreignUuid('decided_by_user_id')->nullable()->constrained('users');
            $table->string('decided_proof', 16)->nullable();
            $table->dateTime('decided_at', 6)->nullable();
            $table->dateTime('executed_at', 6)->nullable();
            $table->string('failure_code', 40)->nullable();
            $table->dateTime('expires_at', 6);
            $table->unsignedInteger('lock_version')->default(0);
            $table->string('live_key', 100)->nullable()->storedAs($vivante);
            $table->datetimes(6);

            $table->unique('live_key', 'operator_approvals_live_key_unique');
            $table->index(['status', 'expires_at'], 'operator_approvals_status_expires_idx');
            $table->index('subject_id', 'operator_approvals_subject_idx');
        });

        Checks::add('operator_approvals', 'action', Checks::enum('action', ApprovableAction::class));
        Checks::add('operator_approvals', 'status', Checks::enum('status', ApprovalStatus::class));
        Checks::add('operator_approvals', 'requested_proof', "requested_proof IN ('totp', 'recovery_code')");
        Checks::add('operator_approvals', 'decided_proof', "decided_proof IS NULL OR decided_proof IN ('totp', 'recovery_code', 'artisan')");

        RowGuards::install([
            ['operator_approvals_demande_figee', 'BEFORE UPDATE', 'operator_approvals', RowGuards::changed(['action', 'subject_type', 'subject_id', 'organization_id', 'payload', 'reason', 'ticket_reference', 'requested_by_user_id', 'requested_proof', 'expires_at', 'created_at']), 'operator_approvals : demande figee'],
            ['operator_approvals_statut_final', 'BEFORE UPDATE', 'operator_approvals', "OLD.status <> 'pending' AND (".RowGuards::changed(['status', 'decided_by_user_id', 'decided_proof', 'decided_at', 'executed_at']).')', 'operator_approvals : decision finale'],
            ['operator_approvals_sans_suppression', 'BEFORE DELETE', 'operator_approvals', '1 = 1', 'operator_approvals ne se supprime pas'],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('operator_approvals');
    }
};
