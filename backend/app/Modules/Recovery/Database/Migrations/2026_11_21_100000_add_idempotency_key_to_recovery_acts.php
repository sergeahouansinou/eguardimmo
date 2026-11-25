<?php

declare(strict_types=1);

use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recovery_acts', function (Blueprint $table): void {
            $table->string('idempotency_key', 64)->nullable()->after('note');
            $table->unique(['organization_id', 'author_user_id', 'idempotency_key'], 'recovery_acts_org_author_idem_unique');
        });

        Checks::add('recovery_acts', 'idempotency_author', 'idempotency_key IS NULL OR author_user_id IS NOT NULL');
    }

    public function down(): void
    {
        if (DB::table('recovery_acts')->whereNotNull('idempotency_key')->exists()) {
            throw new RuntimeException('Des diligences portent une clé d\'idempotence : la migration ne se défait pas sans perdre cette trace.');
        }

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE recovery_acts DROP CHECK recovery_acts_idempotency_author_check');
        }

        Schema::table('recovery_acts', function (Blueprint $table): void {
            $table->dropUnique('recovery_acts_org_author_idem_unique');
            $table->dropColumn('idempotency_key');
        });
    }
};
