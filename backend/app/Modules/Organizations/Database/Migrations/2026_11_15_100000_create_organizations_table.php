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
        Schema::create('organizations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('kind', 16);
            $table->string('name', 160);
            $table->char('country', 2);
            $table->boolean('two_factor_required')->default(false);
            $table->foreignUuid('created_by_user_id')->constrained('users');
            $table->datetimes(6);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE organizations ADD CONSTRAINT organizations_kind_check CHECK (kind IN ('agency', 'individual'))");
            DB::statement("ALTER TABLE organizations ADD CONSTRAINT organizations_country_check CHECK (country REGEXP '^[A-Z]{2}$')");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('organizations');
    }
};
