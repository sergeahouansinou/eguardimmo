<?php

declare(strict_types=1);

namespace App\Modules\Planning\Actions;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Planning\Data\NewTaskData;
use App\Modules\Planning\Enums\ErrorCode;
use App\Modules\Planning\Enums\TaskStatus;
use App\Modules\Planning\Events\TaskAssigned;
use App\Modules\Planning\Models\PlanningTask;
use App\Modules\Planning\Support\Assignees;
use App\Modules\Planning\Support\LinkResolver;
use App\Modules\Planning\Support\Reminders;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class CreateTask
{
    public function __construct(
        private LinkResolver $liens,
        private Assignees $responsables,
        private OrganizationDirectory $organisation,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Rejouable par `client_id` : le même identifiant avec le même contenu rend la tâche déjà créée, avec un autre contenu il est refusé.
     *
     * @return array{task: PlanningTask, replayed: bool}
     */
    public function handle(string $userId, NewTaskData $donnees): array
    {
        if ($donnees->clientId !== null && ($existante = PlanningTask::query()->where('client_id', $donnees->clientId)->first()) !== null) {
            return $this->rejouer($existante, $donnees);
        }

        $liens = $this->liens->resolve($donnees->propertyId, $donnees->unitId, $donnees->leaseId);
        $donnees->assigneeUserId === null || $this->responsables->assertActive($donnees->assigneeUserId);
        $fuseau = $this->organisation->timezone();

        try {
            $tache = DB::transaction(function () use ($userId, $donnees, $liens, $fuseau): PlanningTask {
                $tache = new PlanningTask([
                    'title' => $donnees->title,
                    'due_on' => $donnees->dueOn,
                    'assignee_user_id' => $donnees->assigneeUserId,
                    'status' => TaskStatus::Open,
                    'remind_days_before' => $donnees->remindDaysBefore,
                    'property_id' => $liens->propertyId,
                    'unit_id' => $liens->unitId,
                    'lease_id' => $liens->leaseId,
                    'client_id' => $donnees->clientId,
                    'created_by_user_id' => $userId,
                    'lock_version' => 1,
                ]);
                $tache->next_reminder_at = Reminders::taskNext($tache, CarbonImmutable::now(), $fuseau);
                $tache->save();

                if ($tache->assignee_user_id !== null && $tache->assignee_user_id !== $userId) {
                    TaskAssigned::dispatch($tache->id, $this->contexte->id(), $tache->assignee_user_id, $userId, $tache->lock_version);
                }

                return $tache;
            });
        } catch (UniqueConstraintViolationException $erreur) {
            return $this->rejouer(PlanningTask::query()->where('client_id', $donnees->clientId)->firstOr(fn () => throw $erreur), $donnees);
        }

        return ['task' => $tache, 'replayed' => false];
    }

    /**
     * @return array{task: PlanningTask, replayed: bool}
     */
    private function rejouer(PlanningTask $existante, NewTaskData $donnees): array
    {
        $memes = $existante->title === $donnees->title
            && $existante->due_on->toDateString() === $donnees->dueOn
            && $existante->assignee_user_id === $donnees->assigneeUserId
            && $existante->remind_days_before === $donnees->remindDaysBefore
            && ($donnees->unitId === null || $existante->unit_id === $donnees->unitId)
            && ($donnees->propertyId === null || $existante->property_id === $donnees->propertyId)
            && $existante->lease_id === $donnees->leaseId;

        if (! $memes) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return ['task' => $existante, 'replayed' => true];
    }
}
