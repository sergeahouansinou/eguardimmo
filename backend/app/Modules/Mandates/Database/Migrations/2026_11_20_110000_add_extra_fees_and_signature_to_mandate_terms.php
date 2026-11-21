<?php

declare(strict_types=1);

use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mandate_terms', function (Blueprint $table): void {
            $table->unsignedSmallInteger('letting_fee_basis_points')->nullable();
            $table->unsignedSmallInteger('works_fee_basis_points')->nullable();
            $table->uuid('signed_file_id')->nullable();
        });

        Checks::add('mandate_terms', 'letting_fee_bp', 'letting_fee_basis_points IS NULL OR letting_fee_basis_points BETWEEN 0 AND 10000');
        Checks::add('mandate_terms', 'works_fee_bp', 'works_fee_basis_points IS NULL OR works_fee_basis_points BETWEEN 0 AND 10000');
    }

    public function down(): void
    {
        Schema::table('mandate_terms', function (Blueprint $table): void {
            $table->dropColumn(['letting_fee_basis_points', 'works_fee_basis_points', 'signed_file_id']);
        });
    }
};
