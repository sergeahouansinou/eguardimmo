<?php

declare(strict_types=1);

use App\Modules\Parties\Enums\BankAccountStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bank_accounts', function (Blueprint $table): void {
            $table->string('status', 10)->default(BankAccountStatus::Active->value);
            $table->dateTime('activated_at', 6)->nullable();
        });

        Checks::add('bank_accounts', 'status', Checks::enum('status', BankAccountStatus::class));
    }

    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE bank_accounts DROP CONSTRAINT bank_accounts_status_check');
        }

        Schema::table('bank_accounts', function (Blueprint $table): void {
            $table->dropColumn(['status', 'activated_at']);
        });
    }
};
