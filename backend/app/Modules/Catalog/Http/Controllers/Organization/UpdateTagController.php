<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Actions\UpdateTag;
use App\Modules\Catalog\Http\Requests\SaveTagRequest;
use App\Modules\Catalog\Http\Resources\TagResource;
use App\Modules\Catalog\Queries\Tags;

final class UpdateTagController
{
    public function __invoke(SaveTagRequest $request, string $tag, Tags $etiquettes, UpdateTag $modifier): TagResource
    {
        return new TagResource($modifier->handle($etiquettes->get($tag), $request->name(), $request->color()));
    }
}
