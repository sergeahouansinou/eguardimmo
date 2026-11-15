<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Queries;

use App\Modules\Catalog\Data\TagData;
use App\Modules\Catalog\Models\Tag;
use App\Modules\Catalog\Models\Tagging;

final readonly class TagsOf
{
    /**
     * @return list<TagData>
     */
    public function list(string $taggableType, string $taggableId): array
    {
        return array_values(Tag::query()
            ->whereIn('id', Tagging::query()->where('taggable_type', $taggableType)->where('taggable_id', $taggableId)->select('tag_id'))
            ->orderBy('name')
            ->get()
            ->map(fn (Tag $etiquette): TagData => new TagData($etiquette->id, $etiquette->name, $etiquette->slug, $etiquette->color))
            ->all());
    }
}
