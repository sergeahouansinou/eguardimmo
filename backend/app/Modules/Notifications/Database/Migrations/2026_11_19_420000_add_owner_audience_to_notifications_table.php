<?php

declare(strict_types=1);

use App\Modules\Notifications\Enums\NotificationAudience;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table): void {
            $table->uuid('party_id')->nullable();
            $table->index(['party_id', 'organization_id']);
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE notifications DROP CONSTRAINT notifications_audience_check');
        }

        Checks::add('notifications', 'audience', Checks::enum('audience', NotificationAudience::class));
        Checks::add('notifications', 'owner_party', "(audience <> 'owner' OR party_id IS NOT NULL)");
    }

    /**
     * Échoue en MySQL tant que des notifications `owner` existent : la contrainte d'origine ne les admet pas, on ne les efface pas.
     */
    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE notifications DROP CONSTRAINT notifications_owner_party_check');
            DB::statement('ALTER TABLE notifications DROP CONSTRAINT notifications_audience_check');
        }

        Schema::table('notifications', function (Blueprint $table): void {
            $table->dropIndex(['party_id', 'organization_id']);
            $table->dropColumn('party_id');
        });

        Checks::add('notifications', 'audience', "audience IN ('staff', 'tenant')");
    }
};
