<?php

declare(strict_types=1);

use App\Modules\Notifications\Enums\NotificationAudience;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\NotificationType as Type;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Planning\Events\EventReminderDue;
use App\Modules\Planning\Events\TaskAssigned;
use App\Modules\Planning\Events\TaskReminderDue;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Planning\PlanningContext as P;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->equipe = N::equipe($this->org);
    $this->id = fn (): string => (string) Str::uuid7();
});

it('déclare trois types d\'agenda pour l\'équipe, canaux par défaut selon l\'ADR 0038', function (): void {
    $canaux = fn (Type $t): array => array_map(fn (NotificationChannel $c): string => $c->value, $t->defaults());

    foreach ([Type::PlanningTaskAssigned, Type::PlanningTaskDue, Type::PlanningEventReminder] as $type) {
        expect($type->audience())->toBe(NotificationAudience::Staff)
            ->and($type->roles())->toBe([MemberRole::Owner, MemberRole::Admin, MemberRole::Manager, MemberRole::Accountant])
            ->and($type->locked())->toBe([])
            ->and($type->group())->toBe('Agenda')
            ->and($type->pushBody())->not->toBeEmpty();
    }
    expect($canaux(Type::PlanningTaskAssigned))->toBe(['in_app'])
        ->and($canaux(Type::PlanningTaskDue))->toBe(['in_app', 'email'])
        ->and($canaux(Type::PlanningEventReminder))->toBe(['in_app', 'email']);
});

it('prévient l\'assigné seul, une fois par version, sans titre ni nom dans le texte', function (): void {
    $tache = ($this->id)();
    $assigne = $this->equipe['manager'];

    TaskAssigned::dispatch($tache, $this->org->id, $assigne->id, $this->equipe['owner']->id, 2);
    TaskAssigned::dispatch($tache, $this->org->id, $assigne->id, $this->equipe['owner']->id, 2);

    expect(N::nombre($assigne, Type::PlanningTaskAssigned))->toBe(1)
        ->and(N::nombre($this->equipe['owner']))->toBe(0)
        ->and(N::nombre($this->equipe['accountant']))->toBe(0);
    $n = N::premiere($assigne, Type::PlanningTaskAssigned);
    expect($n->link)->toBe("/taches/{$tache}")->and($n->email)->toBeFalse()->and($n->body)->toBe('Une tâche vous a été confiée : retrouvez-la dans vos tâches.');

    TaskAssigned::dispatch($tache, $this->org->id, $assigne->id, $this->equipe['owner']->id, 3);
    expect(N::nombre($assigne, Type::PlanningTaskAssigned))->toBe(2);
});

it('ne prévient plus un assigné qui a quitté l\'organisation', function (): void {
    $parti = $this->equipe['manager'];
    N::retirer($this->org, $parti);

    TaskAssigned::dispatch(($this->id)(), $this->org->id, $parti->id, null, 1);
    TaskReminderDue::dispatch(($this->id)(), $this->org->id, $parti->id, '2026-12-10');

    expect(N::nombre($parti))->toBe(0);
});

it('rappelle l\'échéance d\'une tâche par la messagerie interne et par e-mail, une fois par échéance', function (): void {
    $tache = ($this->id)();
    $assigne = $this->equipe['accountant'];

    TaskReminderDue::dispatch($tache, $this->org->id, $assigne->id, '2026-12-10');
    TaskReminderDue::dispatch($tache, $this->org->id, $assigne->id, '2026-12-10');
    expect(N::nombre($assigne, Type::PlanningTaskDue))->toBe(1);

    $n = N::premiere($assigne, Type::PlanningTaskDue);
    expect($n->email)->toBeTrue()->and($n->link)->toBe("/taches/{$tache}")->and($n->body)->toBe('Une de vos tâches arrive à échéance le 10/12/2026.');

    TaskReminderDue::dispatch($tache, $this->org->id, $assigne->id, '2026-12-17');
    expect(N::nombre($assigne, Type::PlanningTaskDue))->toBe(2);
});

it('rappelle un événement au créateur et aux participants membres, pas aux autres', function (): void {
    $evenement = ($this->id)();
    $destinataires = [$this->equipe['owner']->id, $this->equipe['manager']->id];

    EventReminderDue::dispatch($evenement, $this->org->id, '2026-12-01', $destinataires);
    EventReminderDue::dispatch($evenement, $this->org->id, '2026-12-01', $destinataires);

    expect(N::nombre($this->equipe['owner'], Type::PlanningEventReminder))->toBe(1)
        ->and(N::nombre($this->equipe['manager'], Type::PlanningEventReminder))->toBe(1)
        ->and(N::nombre($this->equipe['accountant']))->toBe(0);
    $n = N::premiere($this->equipe['owner'], Type::PlanningEventReminder);
    expect($n->link)->toBe('/agenda')->and($n->email)->toBeTrue()->and($n->body)->toBe('Un événement de votre agenda a lieu le 01/12/2026.');

    EventReminderDue::dispatch($evenement, $this->org->id, '2026-12-08', $destinataires);
    expect(N::nombre($this->equipe['owner'], Type::PlanningEventReminder))->toBe(2);
});

it('ne sert jamais le compte d\'une autre organisation', function (): void {
    $autre = L::organisation();
    $etranger = L::titulaire($autre);

    TaskAssigned::dispatch(($this->id)(), $this->org->id, $etranger->id, null, 1);
    EventReminderDue::dispatch(($this->id)(), $this->org->id, '2026-12-01', [$etranger->id]);

    expect(N::nombre($etranger))->toBe(0);
});

it('de l\'assignation par l\'API à la notification, sans jamais exposer le titre', function (): void {
    C::semer();
    $this->actingAs($this->equipe['owner']);
    $assigne = $this->equipe['manager'];

    $this->postJson(P::url($this->org, '/tasks'), P::tache(['title' => 'Dossier confidentiel Martin', 'assignee_user_id' => $assigne->id]))->assertCreated();

    expect(N::nombre($assigne, Type::PlanningTaskAssigned))->toBe(1);
    $contenu = json_encode(Notification::query()->where('user_id', $assigne->id)->get()->toArray(), JSON_THROW_ON_ERROR);
    expect($contenu)->not->toContain('Martin')->and($contenu)->not->toContain('confidentiel');
});
