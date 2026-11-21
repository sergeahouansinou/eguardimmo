<?php

declare(strict_types=1);

namespace App\Modules\Planning\Actions;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Planning\Enums\ErrorCode;
use App\Modules\Planning\Enums\TaskStatus;
use App\Modules\Planning\Support\BulkTasks;
use App\Modules\Planning\Support\Reminders;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class BulkPostponeTasks
{
    public function __construct(private OrganizationDirectory $organisation) {}

    /**
     * Reporte l'échéance de tâches ouvertes à une même date ; les rappels suivent. Tout ou rien.
     *
     * @param  list<string>  $ids
     * @return int nombre de tâches reportées
     */
    public function handle(array $ids, string $dueOn): int
    {
        $fuseau = $this->organisation->timezone();

        return DB::transaction(function () use ($ids, $dueOn, $fuseau): int {
            $taches = BulkTasks::lock($ids);

            foreach ($taches as $tache) {
                $tache->status === TaskStatus::Open || throw ErrorCode::TaskNotOpen->problem();
            }

            foreach ($taches as $tache) {
                $tache->forceFill(['due_on' => $dueOn, 'lock_version' => $tache->lock_version + 1]);
                $tache->next_reminder_at = Reminders::taskNext($tache, CarbonImmutable::now(), $fuseau);
                $tache->save();
            }

            return count($taches);
        });
    }
}
