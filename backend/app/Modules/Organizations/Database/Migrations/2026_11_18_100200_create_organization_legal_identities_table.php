<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\VatRegime;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_legal_identities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('legal_name', 200);
            $table->json('address');
            $table->string('siren', 9);
            $table->string('siret', 14)->nullable();
            $table->string('vat_number', 20)->nullable();
            $table->string('legal_form', 80)->nullable();
            $table->unsignedBigInteger('share_capital')->nullable();
            $table->char('currency', 3);
            $table->string('registry_city', 120)->nullable();
            $table->string('professional_card_number', 60)->nullable();
            $table->string('professional_card_issuer', 120)->nullable();
            $table->string('guarantee_provider', 160)->nullable();
            $table->unsignedBigInteger('guarantee_amount')->nullable();
            $table->string('vat_regime', 16);
            $table->boolean('vat_on_debits')->default(false);
            $table->unsignedSmallInteger('payment_terms_days')->nullable();
            $table->datetimes(6);

            $table->unique('organization_id');
            $table->unique(['organization_id', 'id']);
        });

        Checks::add('organization_legal_identities', 'vat_regime', Checks::enum('vat_regime', VatRegime::class));
        Checks::add('organization_legal_identities', 'currency', Checks::uppercase('currency', 3));
        Checks::add('organization_legal_identities', 'siren', "REGEXP_LIKE(siren, '^[0-9]{9}$')");
        Checks::add('organization_legal_identities', 'payment_terms', 'payment_terms_days IS NULL OR payment_terms_days BETWEEN 0 AND 120');
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_legal_identities');
    }
};
