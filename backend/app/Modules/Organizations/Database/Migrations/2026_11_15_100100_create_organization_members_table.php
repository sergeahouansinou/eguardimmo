<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_members', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->foreignUuid('user_id')->nullable()->constrained('users');
            $table->string('email', 254);
            $table->string('first_name', 60);
            $table->string('last_name', 60);
            $table->string('role', 16);
            $table->string('status', 16);
            $table->string('scope_type', 16)->default('all');
            $table->json('scope_property_ids')->nullable();
            $table->string('message', 500)->nullable();
            $table->char('invitation_token_hash', 64)->nullable()->unique();
            $table->dateTime('invitation_expires_at', 6)->nullable();
            $table->dateTime('invited_at', 6)->nullable();
            $table->foreignUuid('invited_by_user_id')->nullable()->constrained('users');
            $table->dateTime('joined_at', 6)->nullable();
            $table->dateTime('disabled_at', 6)->nullable();
            $table->datetimes(6);
            $table->softDeletesDatetime(precision: 6);

            $table->unique(['organization_id', 'email']);
            $table->unique(['organization_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check CHECK (role IN ('owner', 'admin', 'manager', 'accountant'))");
            DB::statement("ALTER TABLE organization_members ADD CONSTRAINT organization_members_status_check CHECK (status IN ('invited', 'active', 'disabled'))");
            DB::statement("ALTER TABLE organization_members ADD CONSTRAINT organization_members_scope_check CHECK (scope_type IN ('all', 'selected'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_members');
    }
};
