<?php

declare(strict_types=1);

namespace App\Modules\Planning\Support;

use App\Modules\Planning\Enums\ErrorCode;
use App\Modules\Planning\Models\PlanningTask;
use Illuminate\Support\Str;

/**
 * Actions groupées : 100 identifiants au plus, verrouillés d'un coup dans la transaction de l'appelant. Un identifiant inconnu ou
 * d'une autre organisation annule tout (404), de sorte qu'un lot partiellement inconnu n'a aucun effet.
 */
final class BulkTasks
{
    public const int MAX = 100;

    /**
     * @param  list<string>  $ids
     * @return list<PlanningTask> dans l'ordre des identifiants
     */
    public static function lock(array $ids): array
    {
        $ids = array_values(array_unique($ids));

        if (count($ids) > self::MAX) {
            throw ErrorCode::BulkTooLarge->problem();
        }

        if (array_filter($ids, fn (string $id): bool => ! Str::isUuid($id)) !== []) {
            throw ErrorCode::TaskNotFound->problem();
        }

        $taches = PlanningTask::query()->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');

        return array_map(fn (string $id): PlanningTask => $taches->get($id) ?? throw ErrorCode::TaskNotFound->problem(), $ids);
    }
}
