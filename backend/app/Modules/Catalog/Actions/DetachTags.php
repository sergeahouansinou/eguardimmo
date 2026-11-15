<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Models\Tagging;

final readonly class DetachTags
{
    /**
     * @param  list<string>  $tagIds
     */
    public function handle(string $taggableType, string $taggableId, array $tagIds): void
    {
        Tagging::query()
            ->where('taggable_type', $taggableType)
            ->where('taggable_id', $taggableId)
            ->whereIn('tag_id', $tagIds)
            ->delete();
    }
}
