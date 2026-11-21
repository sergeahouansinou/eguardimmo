<?php

declare(strict_types=1);

use App\Modules\Parties\Enums\ContactUpdateStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_update_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->foreignUuid('party_id')->constrained('parties');
            $table->uuid('requested_by_user_id');
            $table->uuid('client_id');
            $table->text('email')->nullable();
            $table->text('phone')->nullable();
            $table->string('status', 16);
            $table->uuid('decided_by_user_id')->nullable();
            $table->dateTime('decided_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique(['party_id', 'client_id']);
            $table->index(['organization_id', 'party_id', 'status'], 'contact_update_party_status_idx');
            $table->index('created_at');
        });

        Checks::add('contact_update_requests', 'status', Checks::enum('status', ContactUpdateStatus::class));
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_update_requests');
    }
};
