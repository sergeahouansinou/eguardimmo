<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Enums\SuspensionReason;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('operators', function (Blueprint $table): void {
            $table->dateTime('granted_at', 6)->change();
            $table->dateTime('revoked_at', 6)->nullable()->change();
            $table->dateTime('created_at', 6)->nullable()->change();
            $table->dateTime('updated_at', 6)->nullable()->change();
        });

        Schema::create('operator_roles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('operator_id')->constrained('operators')->cascadeOnDelete();
            $table->string('role', 16);
            $table->dateTime('granted_at', 6);
            $table->foreignUuid('granted_by_user_id')->nullable()->constrained('users');
            $table->unique(['operator_id', 'role'], 'operator_roles_operator_role_unique');
        });

        Checks::add('operator_roles', 'role', Checks::enum('role', OperatorRole::class));

        Schema::table('users', function (Blueprint $table): void {
            $table->dateTime('suspended_at', 6)->nullable();
            $table->string('suspension_reason', 16)->nullable();
            $table->foreignUuid('suspended_by_user_id')->nullable()->constrained('users');
            $table->foreignUuid('suspension_reviewed_by_user_id')->nullable()->constrained('users');
            $table->dateTime('suspension_reviewed_at', 6)->nullable();
        });

        Checks::add('users', 'suspension_reason', Checks::enum('suspension_reason', SuspensionReason::class, nullable: true));

        $this->migrerLesOperateursActifs();
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('suspension_reviewed_by_user_id');
            $table->dropConstrainedForeignId('suspended_by_user_id');
            $table->dropColumn(['suspended_at', 'suspension_reason', 'suspension_reviewed_at']);
        });

        Schema::dropIfExists('operator_roles');
    }

    private function migrerLesOperateursActifs(): void
    {
        foreach (DB::table('operators')->whereNull('revoked_at')->pluck('id') as $operateur) {
            DB::table('operator_roles')->insert([
                'id' => (string) Str::uuid7(),
                'operator_id' => $operateur,
                'role' => OperatorRole::Admin->value,
                'granted_at' => now()->format('Y-m-d H:i:s.u'),
            ]);
        }
    }
};
