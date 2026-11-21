<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use App\Modules\Organizations\Data\ActivityEntryData;

final class ActivityShape
{
    /**
     * @return array<string, mixed>
     */
    public static function actor(ActivityEntryData $e): array
    {
        return ['kind' => $e->actorKind, 'id' => $e->actorId, 'name' => $e->actorName, 'active' => $e->actorActive];
    }

    /**
     * @return array{type: string, id: string}|null
     */
    public static function subject(ActivityEntryData $e): ?array
    {
        return $e->subjectType === null || $e->subjectId === null ? null : ['type' => $e->subjectType, 'id' => $e->subjectId];
    }
}
