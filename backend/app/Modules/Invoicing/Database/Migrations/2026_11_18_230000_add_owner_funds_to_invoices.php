<?php

declare(strict_types=1);

use App\Modules\Invoicing\Enums\PaymentMethod;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table): void {
            $table->uuid('fee_statement_id')->nullable();
            $table->unique(['organization_id', 'fee_statement_id']);
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE invoice_payments DROP CHECK invoice_payments_method_check');
            Checks::add('invoice_payments', 'method', Checks::enum('method', PaymentMethod::class));
        }
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropUnique(['organization_id', 'fee_statement_id']);
            $table->dropColumn('fee_statement_id');
        });
    }
};
