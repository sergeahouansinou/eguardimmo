<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE accounts DROP CHECK accounts_role_check');
            Checks::add('accounts', 'role', Checks::enum('role', AccountRole::class));
        }
    }

    public function down(): void
    {
        // Le contrôle élargi reste en place : les comptes `customer_receivable` et `vat_deferred` peuvent déjà exister.
    }
};
