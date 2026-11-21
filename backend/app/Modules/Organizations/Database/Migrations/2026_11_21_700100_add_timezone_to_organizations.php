<?php

declare(strict_types=1);

use App\Modules\Organizations\Support\OrganizationTimezone;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table): void {
            $table->string('timezone', 64)->default(OrganizationTimezone::FALLBACK);
        });

        foreach (OrganizationTimezone::DEFAULTS as $pays => $fuseau) {
            DB::table('organizations')->where('country', $pays)->update(['timezone' => $fuseau]);
        }
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table): void {
            $table->dropColumn('timezone');
        });
    }
};
