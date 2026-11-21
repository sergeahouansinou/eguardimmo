<?php

declare(strict_types=1);

use App\Modules\Payments\Enums\OnlinePaymentMethod;
use App\Modules\Payments\Enums\OnlinePaymentStatus;
use App\Modules\Payments\Enums\PaymentAccountStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_accounts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('provider', 16);
            $table->string('provider_account_id', 120);
            $table->string('status', 12);
            $table->dateTime('onboarded_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'provider'], 'payment_accounts_provider_unique');
        });

        Checks::add('payment_accounts', 'status', Checks::enum('status', PaymentAccountStatus::class));

        Schema::create('online_payments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->uuid('party_id');
            $table->uuid('created_by_user_id');
            $table->json('installment_ids');
            $table->char('installments_hash', 64);
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->string('method', 16);
            $table->string('status', 12);
            $table->string('live_key', 160)->nullable()->virtualAs($this->liveKey());
            $table->string('provider', 16);
            $table->string('provider_reference', 120)->nullable();
            $table->text('checkout_url')->nullable();
            $table->uuid('client_id');
            $table->string('failure_code', 60)->nullable();
            $table->dateTime('confirmed_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique('live_key', 'online_payments_live_unique');
            $table->unique(['organization_id', 'id']);
            $table->unique(['provider', 'provider_reference'], 'online_payments_reference_unique');
            $table->unique(['organization_id', 'client_id'], 'online_payments_client_unique');
            $table->index(['organization_id', 'lease_id', 'created_at'], 'online_payments_lease_idx');
            $table->index(['status', 'created_at'], 'online_payments_status_idx');
        });

        Checks::add('online_payments', 'status', Checks::enum('status', OnlinePaymentStatus::class));
        Checks::add('online_payments', 'method', Checks::enum('method', OnlinePaymentMethod::class));
        Checks::add('online_payments', 'amount', 'amount > 0');

        Schema::create('payment_provider_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('provider', 16);
            $table->string('event_id', 120);
            $table->string('type', 60);
            $table->dateTime('received_at', 6);
            $table->dateTime('processed_at', 6)->nullable();

            $table->unique(['provider', 'event_id'], 'payment_provider_events_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_provider_events');
        Schema::dropIfExists('online_payments');
        Schema::dropIfExists('payment_accounts');
    }

    private function liveKey(): string
    {
        $concat = DB::getDriverName() === 'sqlite' ? "lease_id || '|' || party_id || '|' || installments_hash" : "CONCAT(lease_id, '|', party_id, '|', installments_hash)";

        return "CASE WHEN status IN ('pending', 'processing') THEN {$concat} END";
    }
};
