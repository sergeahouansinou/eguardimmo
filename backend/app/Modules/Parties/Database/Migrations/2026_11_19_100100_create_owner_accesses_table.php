<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Parties\Enums\OwnerAccessStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('owner_accesses', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('mandant_party_id');
            $table->uuid('user_id');
            $table->string('role', 16);
            $table->uuid('person_party_id')->nullable();
            $table->string('status', 16);
            $table->uuid('invitation_id');
            $table->string('consent_version', 16);
            $table->dateTime('consented_at', 6);
            $table->uuid('identity_attested_by_user_id');
            $table->dateTime('identity_attested_at', 6);
            $table->dateTime('revoked_at', 6)->nullable();
            $table->string('revoked_by', 16)->nullable();
            $table->uuid('active_organization_id')->nullable()->virtualAs("CASE WHEN status = 'active' THEN organization_id END");
            $table->uuid('active_mandant_id')->nullable()->virtualAs("CASE WHEN status = 'active' THEN mandant_party_id END");
            $table->uuid('active_user_id')->nullable()->virtualAs("CASE WHEN status = 'active' THEN user_id END");
            $table->datetimes(6);

            $table->unique(['active_organization_id', 'active_mandant_id', 'active_user_id'], 'owner_accesses_active_unique');
            $table->index(['user_id', 'status']);
            $table->index(['organization_id', 'mandant_party_id', 'status']);
            $table->index('person_party_id');
            $table->foreign(['organization_id', 'mandant_party_id'])->references(['organization_id', 'id'])->on('parties');
            $table->foreign(['organization_id', 'person_party_id'])->references(['organization_id', 'id'])->on('parties');
        });

        Checks::add('owner_accesses', 'status', Checks::enum('status', OwnerAccessStatus::class));
        Checks::add('owner_accesses', 'role', Checks::enum('role', OwnerAccessRole::class));
        Checks::add('owner_accesses', 'revoked_by', Checks::enum('revoked_by', OwnerRevoker::class, nullable: true));
        Checks::add('owner_accesses', 'revoked', "((status = 'revoked') = (revoked_at IS NOT NULL AND revoked_by IS NOT NULL))");
        Checks::add('owner_accesses', 'co_owner_person', "(role <> 'co_owner' OR person_party_id IS NOT NULL)");
    }

    public function down(): void
    {
        Schema::dropIfExists('owner_accesses');
    }
};
