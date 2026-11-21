<?php

declare(strict_types=1);

namespace App\Modules\Planning\Actions;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Planning\Enums\TaskStatus;
use App\Modules\Planning\Support\BulkTasks;
use Illuminate\Support\Facades\DB;

final readonly class BulkCompleteTasks
{
    public function __construct(
        private ChangeTaskStatus $statut,
        private OrganizationDirectory $organisation,
    ) {}

    /**
     * Tout ou rien : une tâche déjà clôturée (409) ou inconnue (404) annule le lot.
     *
     * @param  list<string>  $ids
     * @return int nombre de tâches terminées
     */
    public function handle(string $userId, array $ids): int
    {
        $fuseau = $this->organisation->timezone();

        return DB::transaction(function () use ($userId, $ids, $fuseau): int {
            $taches = BulkTasks::lock($ids);

            foreach ($taches as $tache) {
                $this->statut->appliquer($tache, $userId, TaskStatus::Done, $fuseau);
            }

            return count($taches);
        });
    }
}
