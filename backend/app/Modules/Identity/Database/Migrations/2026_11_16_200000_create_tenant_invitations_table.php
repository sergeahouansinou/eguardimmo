<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\TenantInvitationStatus;
use App\Modules\Identity\Enums\TenantRevoker;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_invitations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('party_id');
            $table->string('organization_name', 255);
            $table->string('email', 254);
            $table->char('token_hash', 64)->nullable()->unique();
            $table->string('status', 16);
            $table->dateTime('expires_at', 6);
            $table->foreignUuid('invited_by_user_id')->constrained('users');
            $table->foreignUuid('accepted_by_user_id')->nullable()->constrained('users');
            $table->dateTime('accepted_at', 6)->nullable();
            $table->string('consent_version', 16)->nullable();
            $table->dateTime('revoked_at', 6)->nullable();
            $table->string('revoked_by', 16)->nullable();
            $table->uuid('revoked_by_user_id')->nullable();
            $table->uuid('live_party_id')->nullable()->virtualAs("CASE WHEN status IN ('pending', 'accepted') THEN party_id END")->unique();
            $table->datetimes(6);

            $table->index(['organization_id', 'party_id']);
            $table->index(['accepted_by_user_id', 'status']);
        });

        Checks::add('tenant_invitations', 'status', Checks::enum('status', TenantInvitationStatus::class));
        Checks::add('tenant_invitations', 'revoked_by', Checks::enum('revoked_by', TenantRevoker::class, nullable: true));
        Checks::add('tenant_invitations', 'accepted', "(status <> 'accepted' OR (accepted_by_user_id IS NOT NULL AND accepted_at IS NOT NULL AND consent_version IS NOT NULL))");
        Checks::add('tenant_invitations', 'revoked', "(status <> 'revoked' OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL))");
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_invitations');
    }
};
