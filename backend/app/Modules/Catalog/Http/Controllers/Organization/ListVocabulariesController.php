<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Http\Resources\VocabularyResource;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListVocabulariesController
{
    public function __invoke(): AnonymousResourceCollection
    {
        return VocabularyResource::collection(VocabularyKey::cases());
    }
}
