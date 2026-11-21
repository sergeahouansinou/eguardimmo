<?php

declare(strict_types=1);

namespace App\Modules\Planning\Actions;

use App\Modules\Organizations\Enums\ErrorCode as OrganizationError;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Planning\Enums\ErrorCode;
use App\Modules\Planning\Enums\TaskStatus;
use App\Modules\Planning\Models\PlanningTask;
use App\Modules\Planning\Support\Reminders;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ChangeTaskStatus
{
    public function __construct(private OrganizationDirectory $organisation) {}

    /**
     * Terminer ou annuler suppose une tâche ouverte ; rouvrir, une tâche terminée ou annulée, celle-ci réservée à owner, admin et manager
     * (`$annuleeRouvrable`). Rien n'est supprimé.
     */
    public function handle(PlanningTask $task, string $userId, TaskStatus $cible, bool $annuleeRouvrable = true): PlanningTask
    {
        $fuseau = $this->organisation->timezone();

        return DB::transaction(function () use ($task, $userId, $cible, $fuseau, $annuleeRouvrable): PlanningTask {
            $tache = PlanningTask::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();

            if ($cible === TaskStatus::Open && $tache->status === TaskStatus::Cancelled && ! $annuleeRouvrable) {
                throw OrganizationError::RoleForbidden->problem();
            }

            $this->appliquer($tache, $userId, $cible, $fuseau);

            return $tache;
        });
    }

    /**
     * Dans la transaction de l'appelant, sur une tâche déjà verrouillée.
     */
    public function appliquer(PlanningTask $tache, string $userId, TaskStatus $cible, string $fuseau): void
    {
        $ouverte = $tache->status === TaskStatus::Open;

        if (($cible === TaskStatus::Open) === $ouverte) {
            throw ErrorCode::TaskNotOpen->problem();
        }

        $tache->forceFill([
            'status' => $cible,
            'done_at' => $cible === TaskStatus::Done ? now() : null,
            'done_by_user_id' => $cible === TaskStatus::Done ? $userId : null,
            'lock_version' => $tache->lock_version + 1,
        ]);
        $tache->next_reminder_at = Reminders::taskNext($tache, CarbonImmutable::now(), $fuseau);
        $tache->save();
    }
}
