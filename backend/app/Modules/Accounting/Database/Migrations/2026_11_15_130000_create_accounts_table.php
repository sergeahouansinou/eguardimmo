<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('code', 20);
            $table->string('label', 160);
            $table->string('role', 32);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'role']);
            $table->unique(['organization_id', 'code']);
        });

        Checks::add('accounts', 'role', Checks::enum('role', AccountRole::class));
    }

    public function down(): void
    {
        Schema::dropIfExists('accounts');
    }
};
