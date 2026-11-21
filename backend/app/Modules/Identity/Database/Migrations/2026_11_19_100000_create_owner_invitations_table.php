<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Enums\OwnerInvitationStatus;
use App\Modules\Identity\Enums\OwnerRevoker;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('owner_invitations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('mandant_party_id');
            $table->uuid('person_party_id')->nullable();
            $table->string('role', 16);
            $table->string('organization_name', 255);
            $table->string('email', 254);
            $table->char('token_hash', 64)->nullable()->unique();
            $table->char('code_hash', 64)->nullable();
            $table->unsignedTinyInteger('code_attempts')->default(0);
            $table->string('status', 16);
            $table->dateTime('expires_at', 6);
            $table->foreignUuid('invited_by_user_id')->constrained('users');
            $table->dateTime('identity_attested_at', 6);
            $table->boolean('powers_attested')->default(false);
            $table->foreignUuid('accepted_by_user_id')->nullable()->constrained('users');
            $table->dateTime('accepted_at', 6)->nullable();
            $table->string('consent_version', 16)->nullable();
            $table->dateTime('revoked_at', 6)->nullable();
            $table->string('revoked_by', 16)->nullable();
            $table->uuid('revoked_by_user_id')->nullable();
            $table->uuid('live_mandant_id')->nullable()->virtualAs("CASE WHEN status = 'pending' THEN mandant_party_id END");
            $table->string('live_email', 254)->nullable()->virtualAs("CASE WHEN status = 'pending' THEN email END");
            $table->datetimes(6);

            $table->unique(['live_mandant_id', 'live_email'], 'owner_invitations_live_unique');
            $table->index(['organization_id', 'mandant_party_id']);
            $table->index(['accepted_by_user_id', 'status']);
            $table->index(['status', 'expires_at']);
        });

        Checks::add('owner_invitations', 'status', Checks::enum('status', OwnerInvitationStatus::class));
        Checks::add('owner_invitations', 'role', Checks::enum('role', OwnerAccessRole::class));
        Checks::add('owner_invitations', 'revoked_by', Checks::enum('revoked_by', OwnerRevoker::class, nullable: true));
        Checks::add('owner_invitations', 'accepted', "(status <> 'accepted' OR (accepted_by_user_id IS NOT NULL AND accepted_at IS NOT NULL AND consent_version IS NOT NULL))");
        Checks::add('owner_invitations', 'revoked', "(status <> 'revoked' OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL))");
        Checks::add('owner_invitations', 'attempts', 'code_attempts <= 5');
        Checks::add('owner_invitations', 'pending_secrets', "(status <> 'pending' OR (token_hash IS NOT NULL AND code_hash IS NOT NULL))");
    }

    public function down(): void
    {
        Schema::dropIfExists('owner_invitations');
    }
};
