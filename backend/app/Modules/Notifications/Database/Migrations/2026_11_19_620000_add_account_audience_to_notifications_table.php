<?php

declare(strict_types=1);

use App\Modules\Notifications\Enums\NotificationAudience;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE notifications DROP CONSTRAINT notifications_audience_check');
        }

        Checks::add('notifications', 'audience', Checks::enum('audience', NotificationAudience::class));
        Checks::add('notifications', 'account_without_organization', "(audience <> 'account' OR organization_id IS NULL)");
    }

    /**
     * Échoue en MySQL tant que des notifications `account` existent : la contrainte précédente ne les admet pas, on ne les efface pas.
     */
    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE notifications DROP CONSTRAINT notifications_account_without_organization_check');
            DB::statement('ALTER TABLE notifications DROP CONSTRAINT notifications_audience_check');
        }

        Checks::add('notifications', 'audience', "audience IN ('staff', 'tenant', 'owner')");
    }
};
