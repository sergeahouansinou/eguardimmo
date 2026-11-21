<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\EndRequestStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mandate_end_requests', function (Blueprint $table): void {
            $table->dateTime('decided_at', 6)->nullable()->after('cancelled_at');
            $table->uuid('decided_by_user_id')->nullable()->after('decided_at');
            $table->string('decision_note', 500)->nullable()->after('decided_by_user_id');
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE mandate_end_requests DROP CHECK mandate_end_requests_status_check');
            Checks::add('mandate_end_requests', 'status', Checks::enum('status', EndRequestStatus::class));
        }
    }

    public function down(): void
    {
        // Additive : des demandes déjà rejetées ou satisfaites peuvent exister.
    }
};
