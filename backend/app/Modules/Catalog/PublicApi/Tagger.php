<?php

declare(strict_types=1);

namespace App\Modules\Catalog\PublicApi;

use App\Modules\Catalog\Actions\AttachTags;
use App\Modules\Catalog\Actions\DetachTags;
use App\Modules\Catalog\Data\TagData;
use App\Modules\Catalog\Queries\TagsOf;

/**
 * Pose d'étiquettes sur un objet d'un autre module. L'appelant a déjà vérifié que l'objet appartient à l'organisation
 * courante et fournit l'alias de sa morph map.
 */
final readonly class Tagger
{
    public function __construct(
        private AttachTags $pose,
        private DetachTags $retrait,
        private TagsOf $lecture,
    ) {}

    /**
     * @param  list<string>  $tagIds
     */
    public function attach(string $taggableType, string $taggableId, array $tagIds): void
    {
        $this->pose->handle($taggableType, $taggableId, $tagIds);
    }

    /**
     * @param  list<string>  $tagIds
     */
    public function detach(string $taggableType, string $taggableId, array $tagIds): void
    {
        $this->retrait->handle($taggableType, $taggableId, $tagIds);
    }

    /**
     * @return list<TagData>
     */
    public function tagsOf(string $taggableType, string $taggableId): array
    {
        return $this->lecture->list($taggableType, $taggableId);
    }
}
