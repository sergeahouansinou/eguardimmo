<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Planning\Events\TaskAssigned;
use App\Modules\Planning\Models\PlanningTask;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Planning\PlanningContext as P;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->site = C::site($this->org);
    $this->lot = C::lot($this->org, $this->site);
    $this->actingAs($this->titulaire);
});

function creerTacheApi(array $corps = []): array
{
    return test()->postJson(P::url(test()->org, '/tasks'), P::tache($corps))->assertCreated()->json('data');
}

function tacheEnBase(string $id): PlanningTask
{
    return C::dans(test()->org, fn (): PlanningTask => PlanningTask::query()->findOrFail($id));
}

it('exige un jeton, la bonne organisation et, pour écrire, owner, admin ou manager', function (): void {
    $id = creerTacheApi()['id'];
    $lectures = [P::url($this->org, '/tasks')];
    $ecritures = [
        ['post', P::url($this->org, '/tasks'), P::tache()],
        ['patch', P::url($this->org, "/tasks/{$id}"), ['lock_version' => 1, 'title' => 'Autre']],
        ['post', P::url($this->org, "/tasks/{$id}/cancel"), []],
        ['post', P::url($this->org, '/tasks/bulk/complete'), ['ids' => [$id]]],
        ['post', P::url($this->org, '/tasks/bulk/postpone'), ['ids' => [$id], 'due_on' => '2026-12-10']],
        ['post', P::url($this->org, '/tasks/bulk/assign'), ['ids' => [$id], 'assignee_user_id' => $this->titulaire->id]],
    ];
    $progression = [P::url($this->org, "/tasks/{$id}/complete"), P::url($this->org, "/tasks/{$id}/reopen")];

    auth()->forgetGuards();
    foreach ($lectures as $url) {
        $this->getJson($url)->assertUnauthorized();
    }
    foreach ([...$ecritures, ...array_map(fn (string $u): array => ['post', $u, []], $progression)] as [$methode, $url, $corps]) {
        $this->json($methode, $url, $corps)->assertUnauthorized();
    }

    C::changerDeCompte($this, C::membre($this->org, MemberRole::Accountant));
    $this->getJson(P::url($this->org, '/tasks'))->assertOk();
    foreach ([...$ecritures, ...array_map(fn (string $u): array => ['post', $u, []], $progression)] as [$methode, $url, $corps]) {
        $this->json($methode, $url, $corps)->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    }

    C::changerDeCompte($this, C::titulaire(C::organisation()));
    $this->getJson(P::url($this->org, '/tasks'))->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    foreach ([...$ecritures, ...array_map(fn (string $u): array => ['post', $u, []], $progression)] as [$methode, $url, $corps]) {
        $this->json($methode, $url, $corps)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }
});

it('lit une tâche par son identifiant : même représentation que la liste, tous les rôles, jamais celle d\'une autre organisation', function (): void {
    $cree = creerTacheApi(['assignee_user_id' => $this->titulaire->id]);
    $url = P::url($this->org, "/tasks/{$cree['id']}");
    $liste = $this->getJson(P::url($this->org, '/tasks'))->assertOk()->json('data');

    $this->getJson($url)->assertOk()->assertJsonPath('data.id', $cree['id'])->assertJsonPath('data.assignee_user_id', $this->titulaire->id)->assertJsonPath('data.assignee_active', true);
    expect($this->getJson($url)->json('data'))->toBe($liste[0]);

    foreach ([MemberRole::Accountant, MemberRole::Manager, MemberRole::Admin] as $role) {
        C::changerDeCompte($this, C::membre($this->org, $role));
        $this->getJson($url)->assertOk()->assertJsonPath('data.id', $cree['id']);
    }

    $autre = C::organisation();
    $etrangere = P::creerTache($autre);
    $this->getJson(P::url($this->org, "/tasks/{$etrangere->id}"))->assertNotFound()->assertJsonPath('code', 'planning_task_not_found');
    $this->getJson(P::url($this->org, '/tasks/0199f5d2-0000-7000-8000-000000000001'))->assertNotFound()->assertJsonPath('code', 'planning_task_not_found');
    $this->getJson(P::url($this->org, '/tasks/pas-un-uuid'))->assertNotFound();

    C::changerDeCompte($this, C::titulaire(C::organisation()));
    $this->getJson($url)->assertNotFound()->assertJsonPath('code', 'organization_not_found');

    auth()->forgetGuards();
    $this->getJson($url)->assertUnauthorized();
});

it('ne laisse jamais lire, modifier ni clôturer la tâche d\'une autre organisation', function (): void {
    $autre = C::organisation();
    $etrangere = P::creerTache($autre);
    $url = P::url($this->org, "/tasks/{$etrangere->id}");

    $this->patchJson($url, ['lock_version' => 1, 'title' => 'Pirate'])->assertNotFound()->assertJsonPath('code', 'planning_task_not_found');
    foreach (['complete', 'reopen', 'cancel'] as $action) {
        $this->postJson("{$url}/{$action}")->assertNotFound()->assertJsonPath('code', 'planning_task_not_found');
    }
    expect($this->getJson(P::url($this->org, '/tasks'))->assertOk()->json('data'))->toBe([]);

    $miens = creerTacheApi()['id'];
    foreach (['complete', 'postpone'] as $action) {
        $corps = ['ids' => [$miens, $etrangere->id], 'due_on' => '2026-12-31'];
        $this->postJson(P::url($this->org, "/tasks/bulk/{$action}"), $corps)->assertNotFound()->assertJsonPath('code', 'planning_task_not_found');
    }
    expect(tacheEnBase($miens)->status->value)->toBe('open')->and(tacheEnBase($miens)->due_on->toDateString())->toBe('2026-12-01');
    expect(C::dans($autre, fn (): string => PlanningTask::query()->findOrFail($etrangere->id)->status->value))->toBe('open');
});

it('crée une tâche avec ses liens et un responsable membre, sans accepter les champs serveur', function (): void {
    $membre = C::membre($this->org, MemberRole::Manager);
    $bail = L::bail($this->org);
    R::occuper($this->org, $bail, $this->lot, ['valid_from' => '2026-01-01']);
    Event::fake([TaskAssigned::class]);

    $donnees = creerTacheApi([
        'assignee_user_id' => $membre->id, 'unit_id' => $this->lot->id, 'lease_id' => $bail->id, 'remind_days_before' => 2,
        'status' => 'done', 'done_by_user_id' => $this->titulaire->id, 'created_by_user_id' => (string) fake()->uuid(), 'organization_id' => (string) fake()->uuid(),
    ]);

    expect($donnees)->toMatchArray([
        'title' => 'Relancer le syndic', 'due_on' => '2026-12-01', 'status' => 'open', 'is_overdue' => false, 'assignee_user_id' => $membre->id,
        'assignee_active' => true, 'done_at' => null, 'done_by_user_id' => null, 'remind_days_before' => 2, 'property_id' => $this->site->id,
        'unit_id' => $this->lot->id, 'lease_id' => $bail->id, 'created_by_user_id' => $this->titulaire->id, 'lock_version' => 1,
    ]);
    expect(tacheEnBase($donnees['organization_id'] ?? $donnees['id'])->organization_id)->toBe($this->org->id)
        ->and(tacheEnBase($donnees['id'])->next_reminder_at?->toIso8601ZuluString())->toBe('2026-11-29T07:00:00Z');
    Event::assertDispatched(TaskAssigned::class, fn (TaskAssigned $e): bool => $e->assigneeUserId === $membre->id && $e->taskId === $donnees['id']);
});

it('n\'avertit pas celui qui s\'assigne lui-même', function (): void {
    Event::fake([TaskAssigned::class]);
    creerTacheApi(['assignee_user_id' => $this->titulaire->id]);

    Event::assertNotDispatched(TaskAssigned::class);
});

it('refuse un responsable qui n\'est pas un membre actif de l\'organisation', function (): void {
    $ancien = C::membre($this->org, MemberRole::Manager);
    C::dans($this->org, fn () => OrganizationMember::query()->where('user_id', $ancien->id)->update(['status' => MemberStatus::Disabled]));
    $etranger = C::membre(C::organisation(), MemberRole::Manager);

    foreach ([$etranger->id, $ancien->id, (string) fake()->uuid()] as $responsable) {
        $this->postJson(P::url($this->org, '/tasks'), P::tache(['assignee_user_id' => $responsable]))->assertUnprocessable()->assertJsonPath('code', 'planning_assignee_invalid');
    }
    expect(C::dans($this->org, fn (): int => PlanningTask::query()->count()))->toBe(0);
});

it('valide les champs en liste blanche et refuse le HTML', function (string $champ, mixed $valeur): void {
    $this->postJson(P::url($this->org, '/tasks'), P::tache([$champ => $valeur]))->assertUnprocessable()->assertJsonValidationErrors([$champ]);
})->with([
    'titre vide' => ['title', ''],
    'titre trop long' => ['title', str_repeat('a', 121)],
    'titre HTML' => ['title', '<img src=x onerror=alert(1)>'],
    'échéance invalide' => ['due_on', '2026-13-45'],
    'rappel négatif' => ['remind_days_before', -1],
    'rappel trop lointain' => ['remind_days_before', 91],
    'client non UUID' => ['client_id', 'abc'],
    'bail non UUID' => ['lease_id', 'abc'],
]);

it('vérifie bien, lot et bail avec un seul code d\'erreur', function (): void {
    $autre = C::organisation();
    $lotEtranger = C::lot($autre, C::site($autre));

    foreach ([['unit_id' => $lotEtranger->id], ['lease_id' => (string) fake()->uuid()], ['property_id' => C::site($autre)->id]] as $liens) {
        $this->postJson(P::url($this->org, '/tasks'), P::tache($liens))->assertUnprocessable()->assertJsonPath('code', 'planning_link_invalid');
    }
});

it('rejoue une création avec le même client_id et refuse le même identifiant avec un autre contenu', function (): void {
    $cle = (string) fake()->uuid();
    $premiere = $this->postJson(P::url($this->org, '/tasks'), P::tache(['client_id' => $cle]))->assertCreated()->json('data.id');
    $rejeu = $this->postJson(P::url($this->org, '/tasks'), P::tache(['client_id' => $cle]))->assertOk()->json('data.id');

    expect($rejeu)->toBe($premiere)->and(C::dans($this->org, fn (): int => PlanningTask::query()->count()))->toBe(1);
    $this->postJson(P::url($this->org, '/tasks'), P::tache(['client_id' => $cle, 'title' => 'Autre contenu']))->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');
    expect(C::dans($this->org, fn (): int => PlanningTask::query()->count()))->toBe(1);
});

it('modifie avec la version, refuse une version périmée et réassigne en avertissant le nouveau responsable', function (): void {
    $membre = C::membre($this->org, MemberRole::Manager);
    $tache = creerTacheApi();
    $url = P::url($this->org, "/tasks/{$tache['id']}");
    Event::fake([TaskAssigned::class]);

    $this->patchJson($url, ['lock_version' => 1, 'title' => 'Titre modifié', 'due_on' => '2026-12-15', 'assignee_user_id' => $membre->id])->assertOk()
        ->assertJsonPath('data.title', 'Titre modifié')->assertJsonPath('data.due_on', '2026-12-15')->assertJsonPath('data.lock_version', 2);
    Event::assertDispatched(TaskAssigned::class, fn (TaskAssigned $e): bool => $e->assigneeUserId === $membre->id && $e->lockVersion === 2);

    $this->patchJson($url, ['lock_version' => 1, 'title' => 'Périmé'])->assertConflict()->assertJsonPath('code', 'planning_version_conflict');
    $this->patchJson($url, ['title' => 'Sans version'])->assertUnprocessable()->assertJsonValidationErrors(['lock_version']);
    $this->patchJson($url, ['lock_version' => 2, 'assignee_user_id' => (string) fake()->uuid()])->assertUnprocessable()->assertJsonPath('code', 'planning_assignee_invalid');
    expect(tacheEnBase($tache['id'])->title)->toBe('Titre modifié');
});

it('termine, rouvre et annule une tâche en journalisant l\'auteur', function (): void {
    $tache = creerTacheApi();
    $url = P::url($this->org, "/tasks/{$tache['id']}");

    $this->postJson("{$url}/complete")->assertOk()->assertJsonPath('data.status', 'done')->assertJsonPath('data.done_by_user_id', $this->titulaire->id);
    expect(tacheEnBase($tache['id'])->done_at)->not->toBeNull();
    $this->postJson("{$url}/complete")->assertConflict()->assertJsonPath('code', 'planning_task_not_open');
    $this->postJson("{$url}/reopen")->assertOk()->assertJsonPath('data.status', 'open')->assertJsonPath('data.done_at', null)->assertJsonPath('data.done_by_user_id', null);
    $this->postJson("{$url}/reopen")->assertConflict()->assertJsonPath('code', 'planning_task_not_open');
    $this->postJson("{$url}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');
    $this->postJson("{$url}/complete")->assertConflict()->assertJsonPath('code', 'planning_task_not_open');
    expect(C::dans($this->org, fn (): int => PlanningTask::query()->count()))->toBe(1);
    expect(AuditLog::query()->where('subject_id', $tache['id'])->exists())->toBeTrue();
});

it('laisse l\'assigné et le créateur terminer et rouvrir, pas un comptable étranger à la tâche', function (): void {
    $assigne = C::membre($this->org, MemberRole::Accountant);
    $autre = C::membre($this->org, MemberRole::Accountant);
    $tache = creerTacheApi(['assignee_user_id' => $assigne->id]);
    $url = P::url($this->org, "/tasks/{$tache['id']}");

    C::changerDeCompte($this, $autre);
    $this->postJson("{$url}/complete")->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    $this->postJson("{$url}/reopen")->assertForbidden()->assertJsonPath('code', 'role_forbidden');

    C::changerDeCompte($this, $assigne);
    $this->postJson("{$url}/complete")->assertOk()->assertJsonPath('data.done_by_user_id', $assigne->id);
    $this->postJson("{$url}/reopen")->assertOk();
    $this->postJson("{$url}/cancel")->assertForbidden();

    $creee = P::creerTache($this->org, ['created_by_user_id' => $autre->id]);
    C::changerDeCompte($this, $autre);
    $this->postJson(P::url($this->org, "/tasks/{$creee->id}/complete"))->assertOk();
});

it('pagine par curseur et filtre par statut, responsable, bien, période et retard', function (): void {
    $this->travelTo(now()->setDate(2026, 12, 10)->setTime(12, 0));
    $membre = C::membre($this->org, MemberRole::Manager);
    foreach (['2026-12-01', '2026-12-05', '2026-12-10', '2026-12-20', '2027-01-05'] as $i => $echeance) {
        P::creerTache($this->org, ['due_on' => $echeance, 'title' => "T{$i}", 'assignee_user_id' => $i % 2 === 0 ? $membre->id : null, 'unit_id' => $i === 3 ? $this->lot->id : null, 'property_id' => $i === 3 ? $this->site->id : null]);
    }
    P::creerTache($this->org, ['due_on' => '2026-12-02', 'title' => 'Faite', 'status' => 'done', 'done_at' => now(), 'done_by_user_id' => $this->titulaire->id]);
    P::creerTache($this->org, ['due_on' => '2026-12-03', 'title' => 'Annulée', 'status' => 'cancelled']);
    $titres = fn (string $requete = ''): array => array_column($this->getJson(P::url($this->org, "/tasks{$requete}"))->assertOk()->json('data'), 'title');

    expect($titres())->toBe(['T0', 'Faite', 'T1', 'T2', 'T3', 'T4'])
        ->and($titres('?status=cancelled'))->toBe(['Annulée'])
        ->and($titres("?assignee={$membre->id}"))->toBe(['T0', 'T2', 'T4'])
        ->and($titres("?property={$this->site->id}"))->toBe(['T3'])
        ->and($titres("?unit={$this->lot->id}"))->toBe(['T3'])
        ->and($titres('?due_from=2026-12-05&due_to=2026-12-20'))->toBe(['T1', 'T2'])
        ->and($titres('?due_to=2026-12-10'))->toBe(['T0', 'Faite', 'T1'])
        ->and($titres('?due_from=2026-12-20'))->toBe(['T3', 'T4'])
        ->and($titres('?overdue=1'))->toBe(['T0', 'T1']);
});

it('rejette un filtre invalide et tourne les pages du curseur sans perte', function (): void {
    foreach (range(1, 5) as $i) {
        P::creerTache($this->org, ['due_on' => '2026-12-0'.$i, 'title' => "T{$i}"]);
    }
    $this->getJson(P::url($this->org, '/tasks?status=bidon'))->assertUnprocessable()->assertJsonValidationErrors(['status']);
    $this->getJson(P::url($this->org, '/tasks?assignee=quelquun'))->assertUnprocessable()->assertJsonValidationErrors(['assignee']);
    $this->getJson(P::url($this->org, '/tasks?due_from=2026-12-05&due_to=2026-12-01'))->assertUnprocessable()->assertJsonValidationErrors(['due_to']);

    $vus = [];
    $curseur = null;
    do {
        $page = $this->getJson(P::url($this->org, '/tasks?per_page=2'.($curseur === null ? '' : "&cursor={$curseur}")))->assertOk()->json();
        array_push($vus, ...array_column($page['data'], 'title'));
        $curseur = $page['meta']['next_cursor'];
    } while ($page['meta']['has_more']);

    expect($vus)->toBe(['T1', 'T2', 'T3', 'T4', 'T5']);
});

it('calcule le retard dans le fuseau de l\'organisation, jamais en base', function (): void {
    P::creerTache($this->org, ['due_on' => '2026-12-10', 'title' => 'Limite']);
    $this->travelTo(now()->setDate(2026, 12, 10)->setTime(22, 30));
    $retard = fn (): bool => $this->getJson(P::url($this->org, '/tasks'))->assertOk()->json('data.0.is_overdue');

    expect($retard())->toBeFalse();
    $this->travelTo(now()->setDate(2026, 12, 10)->setTime(23, 30));
    expect($retard())->toBeTrue();
});

it('marque inactif le responsable parti, jusqu\'à réassignation', function (): void {
    $membre = C::membre($this->org, MemberRole::Manager);
    $tache = creerTacheApi(['assignee_user_id' => $membre->id]);
    C::dans($this->org, fn () => OrganizationMember::query()->where('user_id', $membre->id)->update(['status' => MemberStatus::Disabled]));

    $this->getJson(P::url($this->org, '/tasks'))->assertOk()->assertJsonPath('data.0.assignee_user_id', $membre->id)->assertJsonPath('data.0.assignee_active', false);
    $this->patchJson(P::url($this->org, "/tasks/{$tache['id']}"), ['lock_version' => 1, 'assignee_user_id' => $this->titulaire->id])->assertOk()->assertJsonPath('data.assignee_active', true);
});

it('garde un nombre de requêtes constant quel que soit le nombre de tâches', function (): void {
    $membre = C::membre($this->org, MemberRole::Manager);
    $compter = function (): int {
        $n = 0;
        DB::listen(function () use (&$n): void {
            $n++;
        });
        $this->getJson(P::url($this->org, '/tasks?per_page=100'))->assertOk();

        return $n;
    };
    P::creerTache($this->org, ['assignee_user_id' => $membre->id]);
    $un = $compter();
    foreach (range(1, 30) as $_) {
        P::creerTache($this->org, ['assignee_user_id' => $membre->id]);
    }

    expect($compter())->toBe($un);
});

it('réserve à owner, admin et manager la réouverture d\'une tâche annulée', function (): void {
    $assigne = C::membre($this->org, MemberRole::Accountant);
    $tache = creerTacheApi(['assignee_user_id' => $assigne->id]);
    $url = P::url($this->org, "/tasks/{$tache['id']}");
    $this->postJson("{$url}/cancel")->assertOk();

    C::changerDeCompte($this, $assigne);
    $this->postJson("{$url}/reopen")->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    expect(tacheEnBase($tache['id'])->status->value)->toBe('cancelled');

    C::changerDeCompte($this, C::membre($this->org, MemberRole::Manager));
    $this->postJson("{$url}/reopen")->assertOk()->assertJsonPath('data.status', 'open');

    C::changerDeCompte($this, $assigne);
    $this->postJson("{$url}/complete")->assertOk();
    $this->postJson("{$url}/reopen")->assertOk()->assertJsonPath('data.status', 'open');
});
