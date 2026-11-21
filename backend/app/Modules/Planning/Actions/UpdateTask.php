<?php

declare(strict_types=1);

namespace App\Modules\Planning\Actions;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Planning\Data\TaskChangesData;
use App\Modules\Planning\Enums\ErrorCode;
use App\Modules\Planning\Enums\TaskStatus;
use App\Modules\Planning\Events\TaskAssigned;
use App\Modules\Planning\Models\PlanningTask;
use App\Modules\Planning\Support\Assignees;
use App\Modules\Planning\Support\LinkResolver;
use App\Modules\Planning\Support\Reminders;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

final readonly class UpdateTask
{
    private const array CHAMPS = ['title', 'due_on', 'assignee_user_id', 'remind_days_before', 'property_id', 'unit_id', 'lease_id'];

    private const array LIENS = ['property_id', 'unit_id', 'lease_id'];

    public function __construct(
        private LinkResolver $liens,
        private Assignees $responsables,
        private OrganizationDirectory $organisation,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Seule une tâche ouverte se modifie. Confier la tâche à un autre membre prévient celui-ci, sauf s'il se l'attribue lui-même.
     */
    public function handle(PlanningTask $task, string $userId, TaskChangesData $changements): PlanningTask
    {
        $fuseau = $this->organisation->timezone();

        return DB::transaction(function () use ($task, $userId, $changements, $fuseau): PlanningTask {
            $tache = PlanningTask::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();

            if ($tache->status !== TaskStatus::Open) {
                throw ErrorCode::TaskNotOpen->problem();
            }

            if ($tache->lock_version !== $changements->lockVersion) {
                throw ErrorCode::VersionConflict->problem();
            }

            $champs = Arr::only($changements->fields, self::CHAMPS);
            $ancienResponsable = $tache->assignee_user_id;
            $tache->fill($champs);

            if (array_intersect(self::LIENS, array_keys($champs)) !== []) {
                $liens = $this->liens->resolve($tache->property_id, $tache->unit_id, $tache->lease_id);
                $tache->fill(['property_id' => $liens->propertyId, 'unit_id' => $liens->unitId, 'lease_id' => $liens->leaseId]);
            }

            if (array_key_exists('assignee_user_id', $champs) && $tache->assignee_user_id !== null && $tache->assignee_user_id !== $ancienResponsable) {
                $this->responsables->assertActive($tache->assignee_user_id);
            }

            $tache->lock_version = $changements->lockVersion + 1;
            $tache->next_reminder_at = Reminders::taskNext($tache, CarbonImmutable::now(), $fuseau);
            $tache->save();

            if ($tache->assignee_user_id !== null && $tache->assignee_user_id !== $ancienResponsable && $tache->assignee_user_id !== $userId) {
                TaskAssigned::dispatch($tache->id, $this->contexte->id(), $tache->assignee_user_id, $userId, $tache->lock_version);
            }

            return $tache;
        });
    }
}
