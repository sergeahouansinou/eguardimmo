<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\EndRequestStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mandate_end_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('mandate_id');
            $table->uuid('mandant_party_id');
            $table->uuid('access_id');
            $table->uuid('requested_by_user_id');
            $table->string('status', 10);
            $table->string('reason', 1000)->nullable();
            $table->dateTime('cancelled_at', 6)->nullable();
            $table->string('live_key', 36)->nullable()->virtualAs("CASE WHEN status = 'pending' THEN mandate_id END");
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'live_key']);
            $table->index(['organization_id', 'mandate_id', 'status']);
            $table->foreign(['organization_id', 'mandate_id'])->references(['organization_id', 'id'])->on('mandates');
        });

        Checks::add('mandate_end_requests', 'status', Checks::enum('status', EndRequestStatus::class));
    }

    public function down(): void
    {
        Schema::dropIfExists('mandate_end_requests');
    }
};
