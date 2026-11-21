<?php

declare(strict_types=1);

namespace App\Modules\Planning\Actions;

use App\Modules\Planning\Enums\ErrorCode;
use App\Modules\Planning\Enums\TaskStatus;
use App\Modules\Planning\Events\TaskAssigned;
use App\Modules\Planning\Support\Assignees;
use App\Modules\Planning\Support\BulkTasks;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class BulkAssignTasks
{
    public function __construct(
        private Assignees $responsables,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Confie des tâches ouvertes à un membre actif. Chaque tâche réellement changée de responsable le prévient, sauf auto-attribution.
     *
     * @param  list<string>  $ids
     * @return int nombre de tâches confiées
     */
    public function handle(string $userId, array $ids, string $assigneeUserId): int
    {
        $this->responsables->assertActive($assigneeUserId);

        return DB::transaction(function () use ($userId, $ids, $assigneeUserId): int {
            $taches = BulkTasks::lock($ids);

            foreach ($taches as $tache) {
                $tache->status === TaskStatus::Open || throw ErrorCode::TaskNotOpen->problem();
            }

            foreach ($taches as $tache) {
                if ($tache->assignee_user_id === $assigneeUserId) {
                    continue;
                }

                $tache->forceFill(['assignee_user_id' => $assigneeUserId, 'lock_version' => $tache->lock_version + 1])->save();

                if ($assigneeUserId !== $userId) {
                    TaskAssigned::dispatch($tache->id, $this->contexte->id(), $assigneeUserId, $userId, $tache->lock_version);
                }
            }

            return count($taches);
        });
    }
}
