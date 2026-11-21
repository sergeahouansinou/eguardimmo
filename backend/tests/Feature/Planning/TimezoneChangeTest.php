<?php

declare(strict_types=1);

use App\Modules\Planning\Actions\SendReminders;
use App\Modules\Planning\Events\TaskReminderDue;
use App\Modules\Planning\Models\PlanningEvent;
use App\Modules\Planning\Models\PlanningTask;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Planning\PlanningContext as P;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->travelTo(CarbonImmutable::parse('2026-11-20 09:00:00', 'UTC'));
    $this->org = C::organisation();
    $this->owner = C::titulaire($this->org);
    $this->actingAs($this->owner);
    $this->rappel = fn (string $modele, string $id, $org = null): ?string => C::dans($org ?? $this->org, fn (): ?string => $modele::query()->findOrFail($id)->next_reminder_at?->toIso8601ZuluString());
});

function creerRappels(): array
{
    $tache = test()->postJson(P::url(test()->org, '/tasks'), P::tache(['due_on' => '2026-12-10', 'remind_days_before' => 1]))->assertCreated()->json('data.id');
    $faite = test()->postJson(P::url(test()->org, '/tasks'), P::tache(['due_on' => '2026-12-10', 'remind_days_before' => 1]))->assertCreated()->json('data.id');
    test()->postJson(P::url(test()->org, "/tasks/{$faite}/complete"))->assertOk();
    $journee = test()->postJson(P::url(test()->org, '/events'), P::evenement(['start_time' => null, 'reminder_offset_minutes' => 1440]))->assertCreated()->json('data.id');
    $horodate = test()->postJson(P::url(test()->org, '/events'), P::evenement(['reminder_offset_minutes' => 60]))->assertCreated()->json('data.id');

    return compact('tache', 'faite', 'journee', 'horodate');
}

it('recalcule les rappels de tâches et d\'événements sur la journée entière après un changement de fuseau, pas ceux des événements horodatés', function (): void {
    $ids = creerRappels();
    expect(($this->rappel)(PlanningTask::class, $ids['tache']))->toBe('2026-12-09T07:00:00Z')
        ->and(($this->rappel)(PlanningEvent::class, $ids['journee']))->toBe('2026-11-30T07:00:00Z');

    $this->patchJson(C::url($this->org), ['timezone' => 'America/Toronto'])->assertOk();

    expect(($this->rappel)(PlanningTask::class, $ids['tache']))->toBe('2026-12-09T13:00:00Z')
        ->and(($this->rappel)(PlanningEvent::class, $ids['journee']))->toBe('2026-11-30T13:00:00Z')
        ->and(($this->rappel)(PlanningEvent::class, $ids['horodate']))->toBe('2026-12-01T08:00:00Z')
        ->and(($this->rappel)(PlanningTask::class, $ids['faite']))->toBeNull();

    $audit = AuditLog::query()->where('action', 'planning.reminders.recomputed')->where('organization_id', $this->org->id)->sole();
    expect($audit->metadata)->toBe(['tasks' => 1, 'events' => 1, 'timezone' => 'America/Toronto']);
});

it('ne touche pas aux rappels d\'une autre organisation ni à un fuseau inchangé', function (): void {
    $ids = creerRappels();
    $autre = C::organisation();
    C::changerDeCompte($this, C::titulaire($autre));
    $etrangere = $this->postJson(P::url($autre, '/tasks'), P::tache(['due_on' => '2026-12-10', 'remind_days_before' => 1]))->assertCreated()->json('data.id');

    C::changerDeCompte($this, $this->owner);
    $this->patchJson(C::url($this->org), ['timezone' => 'Europe/Paris'])->assertOk();
    expect(AuditLog::query()->where('action', 'planning.reminders.recomputed')->count())->toBe(0)
        ->and(($this->rappel)(PlanningTask::class, $ids['tache']))->toBe('2026-12-09T07:00:00Z');

    $this->patchJson(C::url($this->org), ['timezone' => 'America/Toronto'])->assertOk();
    expect(($this->rappel)(PlanningTask::class, $etrangere, $autre))->toBe('2026-12-09T07:00:00Z')
        ->and(AuditLog::query()->where('action', 'planning.reminders.recomputed')->where('organization_id', $autre->id)->count())->toBe(0);
});

it('émet le rappel recalculé à la bonne heure locale après le changement', function (): void {
    $ids = creerRappels();
    $this->patchJson(C::url($this->org), ['timezone' => 'America/Toronto'])->assertOk();
    Event::fake([TaskReminderDue::class]);
    C::dans($this->org, fn () => PlanningTask::query()->whereKey($ids['tache'])->update(['assignee_user_id' => $this->owner->id]));

    $this->travelTo(CarbonImmutable::parse('2026-12-09 07:30:00', 'UTC'));
    expect(app(SendReminders::class)->handle(CarbonImmutable::now())['tasks'])->toBe(0);

    $this->travelTo(CarbonImmutable::parse('2026-12-09 13:05:00', 'UTC'));
    expect(app(SendReminders::class)->handle(CarbonImmutable::now())['tasks'])->toBe(1);
    Event::assertDispatched(TaskReminderDue::class, fn (TaskReminderDue $e): bool => $e->taskId === $ids['tache']);
});
