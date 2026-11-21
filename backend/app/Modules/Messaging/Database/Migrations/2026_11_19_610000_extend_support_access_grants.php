<?php

declare(strict_types=1);

use App\Modules\Messaging\Enums\EmergencyBasis;
use App\Modules\Messaging\Enums\SupportAccessKind;
use App\Modules\Messaging\Enums\SupportAccessStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_access_grants', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->nullable()->constrained('organizations');
            $table->string('kind', 10)->default('consent');
            $table->json('scopes')->nullable();
            $table->string('status', 10)->default('expired');
            $table->string('emergency_basis', 24)->nullable();
            $table->unsignedSmallInteger('duration_hours')->default(0);
            $table->dateTime('requested_at', 6)->nullable();
            $table->foreignUuid('decided_by_user_id')->nullable()->constrained('users');
            $table->dateTime('decided_at', 6)->nullable();
            $table->dateTime('revoked_at', 6)->nullable();
            $table->foreignUuid('revoked_by_user_id')->nullable()->constrained('users');
            $table->foreignUuid('reviewed_by_user_id')->nullable()->constrained('users');
            $table->dateTime('reviewed_at', 6)->nullable();
            $table->unsignedInteger('read_count')->default(0);
        });

        Schema::table('support_access_grants', function (Blueprint $table): void {
            $table->dateTime('granted_at', 6)->nullable()->change();
            $table->dateTime('expires_at', 6)->nullable()->change();
        });

        // Les accès d'avant le consentement n'avaient aucun effet : ils restent consultables, éteints, hors de toute organisation.
        DB::table('support_access_grants')->update(['scopes' => '[]', 'requested_at' => DB::raw('granted_at')]);

        Schema::table('support_access_grants', function (Blueprint $table): void {
            $table->string('kind', 10)->change();
            $table->string('status', 10)->change();
            $table->unsignedSmallInteger('duration_hours')->change();
            $table->index(['operator_user_id', 'organization_id', 'status'], 'support_grants_guard_index');
            $table->index(['organization_id', 'status', 'requested_at'], 'support_grants_organization_index');
        });

        Checks::add('support_access_grants', 'kind', Checks::enum('kind', SupportAccessKind::class));
        Checks::add('support_access_grants', 'status', Checks::enum('status', SupportAccessStatus::class));
        Checks::add('support_access_grants', 'emergency_basis', Checks::enum('emergency_basis', EmergencyBasis::class, true));
        Checks::add('support_access_grants', 'duration', 'duration_hours <= 72');
    }

    public function down(): void
    {
        Schema::table('support_access_grants', function (Blueprint $table): void {
            $table->dropForeign(['organization_id']);
            $table->dropIndex('support_grants_guard_index');
            $table->dropIndex('support_grants_organization_index');
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            foreach (['kind', 'status', 'emergency_basis', 'duration'] as $contrainte) {
                DB::statement("ALTER TABLE support_access_grants DROP CONSTRAINT support_access_grants_{$contrainte}_check");
            }
        }

        Schema::table('support_access_grants', function (Blueprint $table): void {
            $table->dropColumn('organization_id');
            $table->dropConstrainedForeignId('decided_by_user_id');
            $table->dropConstrainedForeignId('revoked_by_user_id');
            $table->dropConstrainedForeignId('reviewed_by_user_id');
            $table->dropColumn(['kind', 'scopes', 'status', 'emergency_basis', 'duration_hours', 'requested_at', 'decided_at', 'revoked_at', 'reviewed_at', 'read_count']);
        });
    }
};
