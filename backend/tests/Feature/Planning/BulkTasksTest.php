<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Planning\Events\TaskAssigned;
use App\Modules\Planning\Models\PlanningTask;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\Feature\Planning\PlanningContext as P;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->actingAs($this->titulaire);
    $this->taches = array_map(fn (int $i): PlanningTask => P::creerTache($this->org, ['title' => "T{$i}", 'due_on' => '2026-12-0'.$i]), range(1, 3));
    $this->ids = array_map(fn (PlanningTask $t): string => $t->id, $this->taches);
});

function etat(string $id): PlanningTask
{
    return C::dans(test()->org, fn (): PlanningTask => PlanningTask::query()->findOrFail($id));
}

it('termine plusieurs tâches d\'un coup', function (): void {
    $this->postJson(P::url($this->org, '/tasks/bulk/complete'), ['ids' => $this->ids])->assertOk()->assertJsonPath('data.count', 3);

    foreach ($this->ids as $id) {
        expect(etat($id)->status->value)->toBe('done')->and(etat($id)->done_by_user_id)->toBe($this->titulaire->id)->and(etat($id)->done_at)->not->toBeNull();
    }
});

it('reporte plusieurs tâches et recalcule leurs rappels', function (): void {
    C::dans($this->org, fn () => PlanningTask::query()->whereKey($this->ids[0])->update(['remind_days_before' => 1]));
    $this->postJson(P::url($this->org, '/tasks/bulk/postpone'), ['ids' => $this->ids, 'due_on' => '2026-12-24'])->assertOk()->assertJsonPath('data.count', 3);

    foreach ($this->ids as $id) {
        expect(etat($id)->due_on->toDateString())->toBe('2026-12-24')->and(etat($id)->lock_version)->toBe(2);
    }
    expect(etat($this->ids[0])->next_reminder_at?->toIso8601ZuluString())->toBe('2026-12-23T07:00:00Z');
});

it('confie plusieurs tâches à un membre actif et l\'avertit pour chacune', function (): void {
    $membre = C::membre($this->org, MemberRole::Manager);
    Event::fake([TaskAssigned::class]);

    $this->postJson(P::url($this->org, '/tasks/bulk/assign'), ['ids' => $this->ids, 'assignee_user_id' => $membre->id])->assertOk()->assertJsonPath('data.count', 3);

    foreach ($this->ids as $id) {
        expect(etat($id)->assignee_user_id)->toBe($membre->id);
    }
    Event::assertDispatchedTimes(TaskAssigned::class, 3);
});

it('refuse d\'assigner à un non-membre ou à un membre désactivé, sans aucun effet', function (): void {
    $parti = C::membre($this->org, MemberRole::Manager);
    C::dans($this->org, fn () => OrganizationMember::query()->where('user_id', $parti->id)->update(['status' => MemberStatus::Disabled]));

    foreach ([C::membre(C::organisation(), MemberRole::Manager)->id, $parti->id] as $responsable) {
        $this->postJson(P::url($this->org, '/tasks/bulk/assign'), ['ids' => $this->ids, 'assignee_user_id' => $responsable])->assertUnprocessable()->assertJsonPath('code', 'planning_assignee_invalid');
    }
    expect(etat($this->ids[0])->assignee_user_id)->toBeNull();
});

it('n\'a aucun effet si un identifiant est inconnu, d\'une autre organisation ou invalide', function (string $action): void {
    $autre = C::organisation();
    $etrangere = P::creerTache($autre);
    $corps = ['due_on' => '2026-12-31', 'assignee_user_id' => $this->titulaire->id];

    foreach ([(string) fake()->uuid(), $etrangere->id] as $intrus) {
        $this->postJson(P::url($this->org, "/tasks/bulk/{$action}"), ['ids' => [...$this->ids, $intrus], ...$corps])->assertNotFound()->assertJsonPath('code', 'planning_task_not_found');
    }
    $this->postJson(P::url($this->org, "/tasks/bulk/{$action}"), ['ids' => [...$this->ids, 'pas-un-uuid'], ...$corps])->assertUnprocessable();

    foreach ($this->ids as $id) {
        expect(etat($id)->status->value)->toBe('open')->and(etat($id)->lock_version)->toBe(1)->and(etat($id)->assignee_user_id)->toBeNull();
    }
    expect(C::dans($autre, fn (): int => PlanningTask::query()->where('lock_version', 1)->count()))->toBe(1);
})->with(['complete', 'postpone', 'assign']);

it('refuse tout le lot si une tâche est déjà clôturée', function (string $action): void {
    C::dans($this->org, fn () => PlanningTask::query()->whereKey($this->ids[1])->update(['status' => 'cancelled']));

    $this->postJson(P::url($this->org, "/tasks/bulk/{$action}"), ['ids' => $this->ids, 'due_on' => '2026-12-31', 'assignee_user_id' => $this->titulaire->id])->assertConflict()->assertJsonPath('code', 'planning_task_not_open');

    expect(etat($this->ids[0])->status->value)->toBe('open')->and(etat($this->ids[0])->lock_version)->toBe(1);
})->with(['complete', 'postpone', 'assign']);

it('borne un lot à 100 identifiants et valide la forme de la requête', function (): void {
    $cent = array_map(fn (): string => (string) fake()->uuid(), range(1, 101));
    $this->postJson(P::url($this->org, '/tasks/bulk/complete'), ['ids' => $cent])->assertUnprocessable()->assertJsonPath('code', 'planning_bulk_too_large');
    $this->postJson(P::url($this->org, '/tasks/bulk/complete'), ['ids' => array_map(fn (): string => (string) fake()->uuid(), range(1, 501))])->assertUnprocessable()->assertJsonValidationErrors(['ids']);
    $this->postJson(P::url($this->org, '/tasks/bulk/complete'), ['ids' => []])->assertUnprocessable()->assertJsonValidationErrors(['ids']);
    $this->postJson(P::url($this->org, '/tasks/bulk/complete'), [])->assertUnprocessable()->assertJsonValidationErrors(['ids']);
    $this->postJson(P::url($this->org, '/tasks/bulk/postpone'), ['ids' => $this->ids])->assertUnprocessable()->assertJsonValidationErrors(['due_on']);
    $this->postJson(P::url($this->org, '/tasks/bulk/assign'), ['ids' => $this->ids])->assertUnprocessable()->assertJsonValidationErrors(['assignee_user_id']);
});

it('accepte exactement 100 tâches, doublons ignorés', function (): void {
    $maintenant = now();
    $lignes = array_map(fn (int $i): array => [
        'id' => (string) Str::uuid7(), 'organization_id' => $this->org->id, 'title' => "Lot {$i}", 'due_on' => '2026-12-01', 'status' => 'open',
        'created_by_user_id' => $this->titulaire->id, 'lock_version' => 1, 'created_at' => $maintenant, 'updated_at' => $maintenant,
    ], range(1, 100));
    PlanningTask::query()->withoutGlobalScopes()->insert($lignes);
    $ids = array_column($lignes, 'id');

    $this->postJson(P::url($this->org, '/tasks/bulk/complete'), ['ids' => [...$ids, $ids[0]]])->assertOk()->assertJsonPath('data.count', 100);
});
