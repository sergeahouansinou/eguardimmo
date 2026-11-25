<?php

declare(strict_types=1);

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Listings\Enums\CancellationPolicy;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('reference', 14)->unique();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('listing_id');
            $table->uuid('user_id');
            $table->date('check_in');
            $table->date('check_out');
            $table->unsignedSmallInteger('nights');
            $table->unsignedSmallInteger('guests');
            $table->unsignedBigInteger('nightly_minor');
            $table->unsignedBigInteger('subtotal_minor');
            $table->unsignedBigInteger('service_fee_minor');
            $table->unsignedBigInteger('total_minor');
            $table->char('currency', 3);
            $table->string('cancellation_policy', 16);
            $table->string('status', 16)->default(BookingStatus::PendingPayment->value);
            $table->dateTime('expires_at', 6)->nullable();
            $table->dateTime('confirmed_at', 6)->nullable();
            $table->dateTime('cancelled_at', 6)->nullable();
            $table->string('cancel_reason', 32)->nullable();
            $table->unsignedBigInteger('refund_minor')->nullable();
            $table->string('idempotency_key', 64);
            $table->char('fingerprint', 64);
            $table->datetimes(6);

            $table->unique(['user_id', 'idempotency_key'], 'bookings_user_key_unique');
            $table->index(['listing_id', 'status', 'check_in', 'check_out'], 'bookings_listing_stay_idx');
            $table->index(['user_id', 'id'], 'bookings_user_idx');
            $table->index(['organization_id', 'id'], 'bookings_org_idx');
            $table->index(['status', 'expires_at'], 'bookings_expiry_idx');
            $table->index(['status', 'check_out'], 'bookings_elapsed_idx');
        });

        Schema::create('booking_sequences', function (Blueprint $table): void {
            $table->unsignedSmallInteger('year')->primary();
            $table->unsignedBigInteger('last_value');
        });

        Checks::add('bookings', 'status', Checks::enum('status', BookingStatus::class));
        Checks::add('bookings', 'cancellation_policy', Checks::enum('cancellation_policy', CancellationPolicy::class));
        Checks::add('bookings', 'stay', 'check_out > check_in AND nights >= 1 AND guests >= 1');
        Checks::add('bookings', 'total', 'total_minor = subtotal_minor + service_fee_minor');
        Checks::add('bookings', 'cancelled_at', "(status = 'cancelled') = (cancelled_at IS NOT NULL)");
        Checks::add('bookings', 'pending_expiry', "status <> 'pending_payment' OR expires_at IS NOT NULL");
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_sequences');
        Schema::dropIfExists('bookings');
    }
};
