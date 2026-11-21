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
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement($this->mysqlStatement());

            return;
        }

        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->index(['organization_id', 'actor_user_id', 'occurred_at'], 'audit_logs_org_actor_occurred_idx');
            $table->index(['organization_id', 'action', 'occurred_at'], 'audit_logs_org_action_occurred_idx');
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->dropIndex('audit_logs_org_actor_occurred_idx');
            $table->dropIndex('audit_logs_org_action_occurred_idx');
        });
    }

    /**
     * Sur une table volumineuse, la migration échoue plutôt que de recopier la table ou de bloquer les écritures du journal.
     */
    public function mysqlStatement(): string
    {
        return 'ALTER TABLE `audit_logs` '
            .'ADD INDEX `audit_logs_org_actor_occurred_idx` (`organization_id`, `actor_user_id`, `occurred_at`), '
            .'ADD INDEX `audit_logs_org_action_occurred_idx` (`organization_id`, `action`, `occurred_at`), '
            .'ALGORITHM=INPLACE, LOCK=NONE';
    }
};
