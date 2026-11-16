<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Models\Tag;
use App\Modules\Catalog\Models\Tagging;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\UniqueConstraintViolationException;
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
                $this->attacher($id, $taggableType, $taggableId);
            }
        });
    }

    /**
     * Une pose simultanée de la même étiquette a déjà produit l'état voulu : l'unicité violée n'est pas une erreur.
     */
    private function attacher(string $tagId, string $taggableType, string $taggableId): void
    {
        try {
            Tagging::query()->firstOrCreate(['tag_id' => $tagId, 'taggable_type' => $taggableType, 'taggable_id' => $taggableId]);
        } catch (UniqueConstraintViolationException) {
        }
    }
}
