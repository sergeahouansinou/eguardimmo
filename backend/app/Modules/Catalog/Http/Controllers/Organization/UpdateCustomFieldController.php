<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Actions\UpdateCustomField;
use App\Modules\Catalog\Http\Requests\UpdateCustomFieldRequest;
use App\Modules\Catalog\Http\Resources\CustomFieldResource;
use App\Modules\Catalog\Queries\CustomFields;

final class UpdateCustomFieldController
{
    public function __invoke(UpdateCustomFieldRequest $request, string $field, CustomFields $champs, UpdateCustomField $modifier): CustomFieldResource
    {
        return new CustomFieldResource($modifier->handle($champs->get($field), $request->toData()));
    }
}
