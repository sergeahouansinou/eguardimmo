<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\SuspensionReason;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table): void {
            $table->dateTime('suspended_at', 6)->nullable();
            $table->string('suspension_reason', 16)->nullable();
        });

        Checks::add('organizations', 'suspension_reason', Checks::enum('suspension_reason', SuspensionReason::class, nullable: true));
        Checks::add('organizations', 'suspension_pair', '(suspended_at IS NULL) = (suspension_reason IS NULL)');
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table): void {
            $table->dropColumn(['suspended_at', 'suspension_reason']);
        });
    }
};
