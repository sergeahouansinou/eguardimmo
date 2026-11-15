<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Http\Requests\ListCustomFieldsRequest;
use App\Modules\Catalog\Http\Resources\CustomFieldResource;
use App\Modules\Catalog\Queries\CustomFields;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListCustomFieldsController
{
    public function __invoke(ListCustomFieldsRequest $request, CustomFields $champs): AnonymousResourceCollection
    {
        return CustomFieldResource::collection($champs->list($request->entity(), $request->includeArchived()));
    }
}
