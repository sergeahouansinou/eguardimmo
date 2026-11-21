<?php

declare(strict_types=1);

use App\Modules\Planning\Enums\EventKind;
use App\Modules\Planning\Enums\Recurrence;
use App\Modules\Planning\Enums\TaskStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('planning_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('kind', 16);
            $table->string('title', 120);
            $table->string('notes', 1000)->nullable();
            $table->date('starts_on');
            $table->time('start_time')->nullable();
            $table->string('timezone', 64)->nullable();
            $table->string('recurrence', 8)->default(Recurrence::None->value);
            $table->date('recurrence_until')->nullable();
            $table->unsignedSmallInteger('reminder_offset_minutes')->nullable();
            $table->dateTime('next_reminder_at', 6)->nullable();
            $table->uuid('property_id')->nullable();
            $table->uuid('unit_id')->nullable();
            $table->uuid('lease_id')->nullable();
            $table->uuid('created_by_user_id');
            $table->dateTime('cancelled_at', 6)->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id'], 'planning_events_org_id_unique');
            $table->index(['organization_id', 'starts_on'], 'planning_events_org_starts_idx');
            $table->index(['organization_id', 'unit_id'], 'planning_events_org_unit_idx');
            $table->index('next_reminder_at', 'planning_events_next_reminder_idx');
        });

        Schema::create('planning_event_attendees', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('event_id');
            $table->uuid('user_id')->nullable();
            $table->uuid('party_id')->nullable();
            $table->datetimes(6);

            $table->unique(['event_id', 'user_id'], 'planning_attendees_event_user_unique');
            $table->unique(['event_id', 'party_id'], 'planning_attendees_event_party_unique');
            $table->foreign(['organization_id', 'event_id'], 'planning_attendees_event_fk')->references(['organization_id', 'id'])->on('planning_events');
        });

        Schema::create('planning_tasks', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('title', 120);
            $table->date('due_on');
            $table->uuid('assignee_user_id')->nullable();
            $table->string('status', 12)->default(TaskStatus::Open->value);
            $table->dateTime('done_at', 6)->nullable();
            $table->uuid('done_by_user_id')->nullable();
            $table->unsignedSmallInteger('remind_days_before')->nullable();
            $table->dateTime('next_reminder_at', 6)->nullable();
            $table->uuid('property_id')->nullable();
            $table->uuid('unit_id')->nullable();
            $table->uuid('lease_id')->nullable();
            $table->uuid('client_id')->nullable();
            $table->uuid('created_by_user_id');
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id'], 'planning_tasks_org_id_unique');
            $table->index(['organization_id', 'status', 'due_on', 'id'], 'planning_tasks_org_status_due_idx');
            $table->index(['organization_id', 'assignee_user_id', 'status', 'due_on'], 'planning_tasks_org_assignee_idx');
            $table->unique(['organization_id', 'client_id'], 'planning_tasks_org_client_unique');
            $table->index('next_reminder_at', 'planning_tasks_next_reminder_idx');
        });

        Checks::add('planning_events', 'kind', Checks::enum('kind', EventKind::class));
        Checks::add('planning_events', 'recurrence', Checks::enum('recurrence', Recurrence::class));
        Checks::add('planning_events', 'reminder_offset', 'reminder_offset_minutes IS NULL OR reminder_offset_minutes IN (60, 1440)');
        Checks::add('planning_events', 'timezone_time', '(timezone IS NULL) = (start_time IS NULL)');
        Checks::add('planning_event_attendees', 'one_target', '(user_id IS NULL) <> (party_id IS NULL)');
        Checks::add('planning_tasks', 'status', Checks::enum('status', TaskStatus::class));
        Checks::add('planning_tasks', 'remind_days', 'remind_days_before IS NULL OR remind_days_before BETWEEN 0 AND 90');
        Checks::add('planning_tasks', 'done_at', "(status = 'done') = (done_at IS NOT NULL)");
    }

    public function down(): void
    {
        Schema::dropIfExists('planning_event_attendees');
        Schema::dropIfExists('planning_events');
        Schema::dropIfExists('planning_tasks');
    }
};
