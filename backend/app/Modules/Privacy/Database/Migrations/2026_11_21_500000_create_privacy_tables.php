<?php

declare(strict_types=1);

use App\Modules\Privacy\Enums\EventKind;
use App\Modules\Privacy\Enums\RequestChannel;
use App\Modules\Privacy\Enums\RequestKind;
use App\Modules\Privacy\Enums\RequestStatus;
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
            ? "CASE WHEN status IN ('received', 'in_progress') THEN CONCAT(COALESCE(requester_user_id, requester_email_fingerprint), ':', kind) END"
            : "CASE WHEN status IN ('received', 'in_progress') THEN COALESCE(requester_user_id, requester_email_fingerprint) || ':' || kind END";

        Schema::create('privacy_requests', function (Blueprint $table) use ($vivante): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('requester_user_id')->nullable()->constrained('users');
            $table->text('requester_email')->nullable();
            $table->string('requester_email_fingerprint', 64)->nullable();
            $table->string('kind', 16);
            $table->string('channel', 16);
            $table->dateTime('received_at', 6);
            $table->dateTime('due_at', 6);
            $table->dateTime('extended_until', 6)->nullable();
            $table->string('extension_reason', 16)->nullable();
            $table->string('identity_verified_by', 24)->nullable();
            $table->dateTime('identity_verified_at', 6)->nullable();
            $table->foreignUuid('handled_by_user_id')->nullable()->constrained('users');
            $table->string('status', 16);
            $table->string('refusal_reason', 24)->nullable();
            $table->unsignedInteger('forwarded_count')->default(0);
            $table->string('export_path', 120)->nullable();
            $table->dateTime('export_generated_at', 6)->nullable();
            $table->dateTime('export_expires_at', 6)->nullable();
            $table->dateTime('export_downloaded_at', 6)->nullable();
            $table->dateTime('completed_at', 6)->nullable();
            $table->dateTime('overdue_flagged_at', 6)->nullable();
            $table->string('live_key', 120)->nullable()->storedAs($vivante);
            $table->datetimes(6);

            $table->unique('live_key', 'privacy_requests_live_key_unique');
            $table->index(['requester_user_id', 'status'], 'privacy_requests_requester_status_idx');
            $table->index(['status', 'due_at'], 'privacy_requests_status_due_idx');
        });

        Schema::create('privacy_request_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('privacy_request_id')->constrained('privacy_requests');
            $table->string('kind', 24);
            $table->foreignUuid('actor_user_id')->nullable()->constrained('users');
            $table->json('metadata');
            $table->dateTime('occurred_at', 6);

            $table->index(['privacy_request_id', 'occurred_at'], 'privacy_request_events_request_idx');
        });

        Schema::create('privacy_request_forwards', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('privacy_request_id')->constrained('privacy_requests');
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->text('requester_name');
            $table->text('requester_email');
            $table->dateTime('forwarded_at', 6);
            $table->dateTime('handled_at', 6)->nullable();
            $table->foreignUuid('handled_by_user_id')->nullable()->constrained('users');
            $table->datetimes(6);

            $table->unique(['privacy_request_id', 'organization_id'], 'privacy_request_forwards_request_org_unique');
            $table->index(['organization_id', 'handled_at'], 'privacy_request_forwards_org_idx');
        });

        Checks::add('privacy_requests', 'kind', Checks::enum('kind', RequestKind::class));
        Checks::add('privacy_requests', 'channel', Checks::enum('channel', RequestChannel::class));
        Checks::add('privacy_requests', 'status', Checks::enum('status', RequestStatus::class));
        Checks::add('privacy_requests', 'requester', 'requester_user_id IS NOT NULL OR requester_email_fingerprint IS NOT NULL');
        Checks::add('privacy_request_events', 'kind', Checks::enum('kind', EventKind::class));

        RowGuards::install([
            ['privacy_requests_demande_figee', 'BEFORE UPDATE', 'privacy_requests', RowGuards::changed(['requester_user_id', 'requester_email', 'requester_email_fingerprint', 'kind', 'channel', 'received_at', 'created_at']), 'privacy_requests : demande figee'],
            ['privacy_requests_statut_final', 'BEFORE UPDATE', 'privacy_requests', "OLD.status IN ('completed', 'refused') AND (".RowGuards::changed(['status', 'due_at', 'extended_until', 'identity_verified_by', 'refusal_reason', 'completed_at']).')', 'privacy_requests : demande cloturee'],
            ['privacy_requests_sans_suppression', 'BEFORE DELETE', 'privacy_requests', '1 = 1', 'privacy_requests ne se supprime pas'],
            ['privacy_request_events_ajout_seul_upd', 'BEFORE UPDATE', 'privacy_request_events', '1 = 1', 'privacy_request_events : ajout seul'],
            ['privacy_request_events_ajout_seul_del', 'BEFORE DELETE', 'privacy_request_events', '1 = 1', 'privacy_request_events : ajout seul'],
            ['privacy_request_forwards_figee', 'BEFORE UPDATE', 'privacy_request_forwards', RowGuards::changed(['privacy_request_id', 'organization_id', 'requester_name', 'requester_email', 'forwarded_at', 'created_at']).' OR (OLD.handled_at IS NOT NULL AND ('.RowGuards::changed(['handled_at', 'handled_by_user_id']).'))', 'privacy_request_forwards : transmission figee'],
            ['privacy_request_forwards_sans_suppression', 'BEFORE DELETE', 'privacy_request_forwards', '1 = 1', 'privacy_request_forwards ne se supprime pas'],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('privacy_request_forwards');
        Schema::dropIfExists('privacy_request_events');
        Schema::dropIfExists('privacy_requests');
    }
};
