<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Actions\ArchiveCustomField;
use App\Modules\Catalog\Http\Resources\CustomFieldResource;
use App\Modules\Catalog\Queries\CustomFields;

final class RestoreCustomFieldController
{
    public function __invoke(string $field, CustomFields $champs, ArchiveCustomField $archiver): CustomFieldResource
    {
        return new CustomFieldResource($archiver->handle($champs->get($field), false));
    }
}
