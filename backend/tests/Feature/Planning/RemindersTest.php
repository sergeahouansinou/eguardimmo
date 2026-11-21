<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Planning\Actions\SendReminders;
use App\Modules\Planning\Events\EventReminderDue;
use App\Modules\Planning\Events\TaskReminderDue;
use App\Modules\Planning\Models\PlanningEvent;
use App\Modules\Planning\Models\PlanningTask;
use App\Modules\Planning\Support\Reminders;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Tests\Feature\Planning\PlanningContext as P;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->travelTo(CarbonImmutable::parse('2026-11-20 09:00:00', 'UTC'));
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->actingAs($this->titulaire);
    Event::fake([EventReminderDue::class, TaskReminderDue::class]);
});

function envoyerRappels(string $instant): array
{
    test()->travelTo(CarbonImmutable::parse($instant, 'UTC'));

    return app(SendReminders::class)->handle(CarbonImmutable::now());
}

function prochainRappel(string $table, string $id): ?string
{
    $modele = $table === 'event' ? PlanningEvent::class : PlanningTask::class;

    return C::dans(test()->org, fn (): ?string => $modele::query()->findOrFail($id)->next_reminder_at?->toIso8601ZuluString());
}

it('convertit l\'heure locale en UTC autour des changements d\'heure de Paris', function (string $date, string $heure, string $attendu): void {
    expect(Reminders::startsAt($date, $heure, 'Europe/Paris')->toIso8601ZuluString())->toBe($attendu);
})->with([
    'hiver' => ['2027-01-15', '09:00:00', '2027-01-15T08:00:00Z'],
    'été' => ['2027-07-15', '09:00:00', '2027-07-15T07:00:00Z'],
    'heure inexistante du 28/03/2027 avancée' => ['2027-03-28', '02:30:00', '2027-03-28T01:30:00Z'],
    'heure répétée du 31/10/2027 : seconde occurrence' => ['2027-10-31', '02:30:00', '2027-10-31T01:30:00Z'],
    'veille du passage à l\'été' => ['2027-03-27', '23:30:00', '2027-03-27T22:30:00Z'],
    'lendemain du passage à l\'hiver' => ['2027-11-01', '00:30:00', '2027-10-31T23:30:00Z'],
]);

it('place le rappel d\'une tâche à 08:00 locales, y compris sur un changement d\'heure', function (): void {
    expect(Reminders::taskAt('2027-03-29', 1, 'Europe/Paris')->toIso8601ZuluString())->toBe('2027-03-28T06:00:00Z')
        ->and(Reminders::taskAt('2027-03-28', 1, 'Europe/Paris')->toIso8601ZuluString())->toBe('2027-03-27T07:00:00Z')
        ->and(Reminders::taskAt('2027-11-01', 1, 'Europe/Paris')->toIso8601ZuluString())->toBe('2027-10-31T07:00:00Z')
        ->and(Reminders::taskAt('2026-12-10', 0, 'America/Toronto')->toIso8601ZuluString())->toBe('2026-12-10T13:00:00Z');
});

it('émet le rappel d\'un événement une seule fois, au créateur et aux participants membres', function (): void {
    $membre = C::membre($this->org, MemberRole::Manager);
    $id = $this->postJson(P::url($this->org, '/events'), P::evenement(['reminder_offset_minutes' => 60, 'attendees' => [['user_id' => $membre->id], ['party_id' => C::partie($this->org)->id]]]))->assertCreated()->json('data.id');
    expect(prochainRappel('event', $id))->toBe('2026-12-01T08:00:00Z');

    expect(envoyerRappels('2026-12-01 07:59:59'))->toMatchArray(['events' => 0, 'tasks' => 0, 'skipped' => 0]);
    $bilan = envoyerRappels('2026-12-01 08:03:00');
    expect($bilan)->toMatchArray(['events' => 1, 'tasks' => 0, 'skipped' => 0, 'failures' => []]);
    Event::assertDispatched(EventReminderDue::class, fn (EventReminderDue $e): bool => $e->eventId === $id && $e->organizationId === $this->org->id && $e->occurrenceOn === '2026-12-01'
        && count($e->recipientUserIds) === 2 && in_array($this->titulaire->id, $e->recipientUserIds, true) && in_array($membre->id, $e->recipientUserIds, true));

    expect(envoyerRappels('2026-12-01 08:08:00')['events'])->toBe(0)->and(envoyerRappels('2026-12-01 08:13:00')['events'])->toBe(0);
    Event::assertDispatchedTimes(EventReminderDue::class, 1);
    expect(prochainRappel('event', $id))->toBeNull();
});

it('avance le rappel d\'une série à l\'occurrence suivante', function (): void {
    $id = $this->postJson(P::url($this->org, '/events'), P::evenement(['recurrence' => 'weekly', 'reminder_offset_minutes' => 1440]))->assertCreated()->json('data.id');
    expect(prochainRappel('event', $id))->toBe('2026-11-30T09:00:00Z');

    envoyerRappels('2026-11-30 09:01:00');
    expect(prochainRappel('event', $id))->toBe('2026-12-07T09:00:00Z');
    Event::assertDispatched(EventReminderDue::class, fn (EventReminderDue $e): bool => $e->occurrenceOn === '2026-12-01');

    envoyerRappels('2026-12-07 09:01:00');
    Event::assertDispatched(EventReminderDue::class, fn (EventReminderDue $e): bool => $e->occurrenceOn === '2026-12-08');
    expect(prochainRappel('event', $id))->toBe('2026-12-14T09:00:00Z');
});

it('rappelle un événement sur la journée entière à 08:00 locales la veille', function (): void {
    $id = $this->postJson(P::url($this->org, '/events'), P::evenement(['start_time' => null, 'reminder_offset_minutes' => 1440]))->assertCreated()->json('data.id');

    expect(prochainRappel('event', $id))->toBe('2026-11-30T07:00:00Z');
    expect(envoyerRappels('2026-11-30 07:05:00')['events'])->toBe(1);
});

it('saute et journalise un rappel en retard de plus de 24 heures, sans jamais l\'envoyer tard', function (): void {
    Log::spy();
    $id = $this->postJson(P::url($this->org, '/events'), P::evenement(['recurrence' => 'weekly', 'reminder_offset_minutes' => 60]))->assertCreated()->json('data.id');

    $bilan = envoyerRappels('2026-12-20 08:30:00');

    expect($bilan)->toMatchArray(['events' => 0, 'skipped' => 3]);
    Event::assertNotDispatched(EventReminderDue::class);
    Log::shouldHaveReceived('warning')->times(3);
    expect(prochainRappel('event', $id))->toBe('2026-12-22T08:00:00Z');

    $limite = $this->postJson(P::url($this->org, '/events'), P::evenement(['title' => 'Limite', 'starts_on' => '2026-12-25', 'reminder_offset_minutes' => 60]))->assertCreated()->json('data.id');
    expect(envoyerRappels('2026-12-26 08:00:00')['events'])->toBe(1)->and(prochainRappel('event', $limite))->toBeNull();
});

it('ne rappelle pas un événement annulé ni un rappel supprimé par modification', function (): void {
    $annule = $this->postJson(P::url($this->org, '/events'), P::evenement(['reminder_offset_minutes' => 60]))->assertCreated()->json('data.id');
    $modifie = $this->postJson(P::url($this->org, '/events'), P::evenement(['reminder_offset_minutes' => 60]))->assertCreated()->json('data.id');
    $this->postJson(P::url($this->org, "/events/{$annule}/cancel"))->assertOk();
    $this->patchJson(P::url($this->org, "/events/{$modifie}"), ['lock_version' => 1, 'reminder_offset_minutes' => null])->assertOk();

    expect(prochainRappel('event', $annule))->toBeNull()->and(prochainRappel('event', $modifie))->toBeNull();
    expect(envoyerRappels('2026-12-01 09:00:00')['events'])->toBe(0);
});

it('recalcule le rappel quand la date change', function (): void {
    $id = $this->postJson(P::url($this->org, '/events'), P::evenement(['reminder_offset_minutes' => 60]))->assertCreated()->json('data.id');
    $this->patchJson(P::url($this->org, "/events/{$id}"), ['lock_version' => 1, 'starts_on' => '2026-12-05', 'start_time' => '15:00'])->assertOk();

    expect(prochainRappel('event', $id))->toBe('2026-12-05T13:00:00Z');
});

it('émet le rappel d\'une tâche à son responsable, une seule fois', function (): void {
    $membre = C::membre($this->org, MemberRole::Manager);
    $id = $this->postJson(P::url($this->org, '/tasks'), P::tache(['due_on' => '2026-12-10', 'remind_days_before' => 1, 'assignee_user_id' => $membre->id]))->assertCreated()->json('data.id');
    expect(prochainRappel('task', $id))->toBe('2026-12-09T07:00:00Z');

    expect(envoyerRappels('2026-12-09 06:59:00')['tasks'])->toBe(0);
    expect(envoyerRappels('2026-12-09 07:10:00')['tasks'])->toBe(1)->and(envoyerRappels('2026-12-09 07:15:00')['tasks'])->toBe(0);
    Event::assertDispatchedTimes(TaskReminderDue::class, 1);
    Event::assertDispatched(TaskReminderDue::class, fn (TaskReminderDue $e): bool => $e->taskId === $id && $e->assigneeUserId === $membre->id && $e->dueOn === '2026-12-10' && $e->organizationId === $this->org->id);
    expect(prochainRappel('task', $id))->toBeNull();
});

it('ne rappelle ni une tâche sans responsable, ni terminée, ni annulée, ni une échéance déjà passée', function (): void {
    $sans = $this->postJson(P::url($this->org, '/tasks'), P::tache(['due_on' => '2026-12-10', 'remind_days_before' => 1]))->assertCreated()->json('data.id');
    $faite = $this->postJson(P::url($this->org, '/tasks'), P::tache(['due_on' => '2026-12-10', 'remind_days_before' => 1, 'assignee_user_id' => $this->titulaire->id]))->assertCreated()->json('data.id');
    $annulee = $this->postJson(P::url($this->org, '/tasks'), P::tache(['due_on' => '2026-12-10', 'remind_days_before' => 1, 'assignee_user_id' => $this->titulaire->id]))->assertCreated()->json('data.id');
    $passee = $this->postJson(P::url($this->org, '/tasks'), P::tache(['due_on' => '2026-11-20', 'remind_days_before' => 1, 'assignee_user_id' => $this->titulaire->id]))->assertCreated()->json('data.id');
    $this->postJson(P::url($this->org, "/tasks/{$faite}/complete"))->assertOk();
    $this->postJson(P::url($this->org, "/tasks/{$annulee}/cancel"))->assertOk();

    expect(prochainRappel('task', $faite))->toBeNull()->and(prochainRappel('task', $annulee))->toBeNull()->and(prochainRappel('task', $passee))->toBeNull();
    expect(envoyerRappels('2026-12-09 07:10:00')['tasks'])->toBe(0)->and(prochainRappel('task', $sans))->toBeNull();
    Event::assertNotDispatched(TaskReminderDue::class);
});

it('rétablit le rappel d\'une tâche rouverte et le reporte avec l\'échéance', function (): void {
    $id = $this->postJson(P::url($this->org, '/tasks'), P::tache(['due_on' => '2026-12-10', 'remind_days_before' => 1, 'assignee_user_id' => $this->titulaire->id]))->assertCreated()->json('data.id');
    $this->postJson(P::url($this->org, "/tasks/{$id}/complete"))->assertOk();
    $this->postJson(P::url($this->org, "/tasks/{$id}/reopen"))->assertOk();
    expect(prochainRappel('task', $id))->toBe('2026-12-09T07:00:00Z');

    $this->patchJson(P::url($this->org, "/tasks/{$id}"), ['lock_version' => 3, 'due_on' => '2026-12-20'])->assertOk();
    expect(prochainRappel('task', $id))->toBe('2026-12-19T07:00:00Z');
});

it('traite chaque organisation sous son propre contexte', function (): void {
    $autre = C::organisation();
    C::changerDeCompte($this, C::titulaire($autre));
    $idAutre = $this->postJson(P::url($autre, '/events'), P::evenement(['reminder_offset_minutes' => 60]))->assertCreated()->json('data.id');
    C::changerDeCompte($this, $this->titulaire);
    $idMien = $this->postJson(P::url($this->org, '/events'), P::evenement(['reminder_offset_minutes' => 60]))->assertCreated()->json('data.id');

    expect(envoyerRappels('2026-12-01 08:10:00')['events'])->toBe(2);
    Event::assertDispatched(EventReminderDue::class, fn (EventReminderDue $e): bool => $e->eventId === $idMien && $e->organizationId === $this->org->id);
    Event::assertDispatched(EventReminderDue::class, fn (EventReminderDue $e): bool => $e->eventId === $idAutre && $e->organizationId === $autre->id);
});

it('s\'exécute par la commande planning:send-reminders et figure au planificateur toutes les 5 minutes', function (): void {
    $this->postJson(P::url($this->org, '/events'), P::evenement(['reminder_offset_minutes' => 60]))->assertCreated();
    $this->travelTo(CarbonImmutable::parse('2026-12-01 08:05:00', 'UTC'));

    $this->artisan('planning:send-reminders')->expectsOutputToContain('1 rappel(s) d\'événement')->assertSuccessful();

    $planifiees = collect(app(Schedule::class)->events())->filter(fn ($e): bool => str_contains((string) $e->command, 'planning:send-reminders'));
    expect($planifiees)->toHaveCount(1)->and($planifiees->first()->expression)->toBe('*/5 * * * *')->and($planifiees->first()->withoutOverlapping)->toBeTrue();
});
