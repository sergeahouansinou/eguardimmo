<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Models\Tag;
use App\Modules\Catalog\Models\Tagging;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final readonly class AttachTags
{
    /**
     * @param  list<string>  $tagIds
     */
    public function handle(string $taggableType, string $taggableId, array $tagIds): void
    {
        if (Relation::getMorphedModel($taggableType) === null) {
            throw new InvalidArgumentException("Alias [{$taggableType}] absent de la morph map.");
        }

        $ids = array_values(array_unique($tagIds));

        DB::transaction(function () use ($taggableType, $taggableId, $ids): void {
            if (Tag::query()->whereKey($ids)->count() !== count($ids)) {
                throw ErrorCode::TagNotFound->problem();
            }

            foreach ($ids as $id) {
                Tagging::query()->firstOrCreate(['tag_id' => $id, 'taggable_type' => $taggableType, 'taggable_id' => $taggableId]);
            }
        });
    }
}
