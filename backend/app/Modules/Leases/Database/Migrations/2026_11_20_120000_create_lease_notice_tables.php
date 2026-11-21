<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\NoticeRequestEventKind;
use App\Modules\Leases\Enums\NoticeRequestOutcome;
use App\Modules\Leases\Enums\NoticeRequestStatus;
use App\Shared\Database\Checks;
use App\Shared\Database\RowGuards;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const array COLONNES_JOURNAL = ['id', 'organization_id', 'notice_request_id', 'kind', 'actor_user_id', 'ip', 'user_agent', 'reauth_method', 'consent_version', 'data', 'occurred_at'];

    public function up(): void
    {
        Schema::create('lease_notice_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->uuid('party_id');
            $table->string('reason_key', 40);
            $table->date('requested_departure_on');
            $table->date('earliest_departure_on');
            $table->uuid('proof_file_id')->nullable();
            $table->text('forwarding_address')->nullable();
            $table->uuid('letter_document_id')->nullable();
            $table->uuid('letter_file_id')->nullable();
            $table->string('letter_fingerprint', 64)->nullable();
            $table->string('consent_version', 32);
            $table->uuid('client_id');
            $table->string('status', 16);
            $table->date('received_on')->nullable();
            $table->uuid('acknowledged_by_user_id')->nullable();
            $table->dateTime('acknowledged_at', 6)->nullable();
            $table->dateTime('withdrawn_at', 6)->nullable();
            $table->string('closed_outcome', 16)->nullable();
            $table->dateTime('closed_at', 6)->nullable();
            $table->dateTime('late_flagged_at', 6)->nullable();
            $table->string('live_key', 73)->nullable()->virtualAs($this->liveKey());
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['lease_id', 'party_id', 'client_id'], 'lease_notice_client_unique');
            $table->unique('live_key', 'lease_notice_live_unique');
            $table->index(['organization_id', 'status', 'created_at'], 'lease_notice_queue_idx');
            $table->index(['organization_id', 'lease_id'], 'lease_notice_lease_idx');
            $table->index(['party_id', 'status'], 'lease_notice_party_idx');
            $table->foreign(['organization_id', 'lease_id'])->references(['organization_id', 'id'])->on('leases');
        });

        Checks::add('lease_notice_requests', 'status', Checks::enum('status', NoticeRequestStatus::class));
        Checks::add('lease_notice_requests', 'closed_outcome', Checks::enum('closed_outcome', NoticeRequestOutcome::class, nullable: true));

        Schema::create('lease_notice_request_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('notice_request_id');
            $table->string('kind', 16);
            $table->uuid('actor_user_id')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->string('reauth_method', 16)->nullable();
            $table->string('consent_version', 32)->nullable();
            $table->json('data')->nullable();
            $table->dateTime('occurred_at', 6);

            $table->index(['organization_id', 'notice_request_id', 'occurred_at'], 'lease_notice_events_idx');
            $table->foreign(['organization_id', 'notice_request_id'], 'lease_notice_events_request_fk')->references(['organization_id', 'id'])->on('lease_notice_requests');
        });

        Checks::add('lease_notice_request_events', 'kind', Checks::enum('kind', NoticeRequestEventKind::class));

        RowGuards::install(RowGuards::frozenExcept('lease_notice_request_events', self::COLONNES_JOURNAL, []));
    }

    public function down(): void
    {
        Schema::dropIfExists('lease_notice_request_events');
        Schema::dropIfExists('lease_notice_requests');
    }

    private function liveKey(): string
    {
        $concat = DB::getDriverName() === 'sqlite' ? "lease_id || '|' || party_id" : "CONCAT(lease_id, '|', party_id)";

        return "CASE WHEN status IN ('submitted', 'acknowledged') THEN {$concat} END";
    }
};
