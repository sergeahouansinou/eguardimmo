<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Http\Controllers\Organization;

use App\Modules\Accounting\Enums\ErrorCode;
use App\Modules\Accounting\Http\Resources\EntryResource;
use App\Modules\Accounting\Queries\Entries;

final class ShowEntryController
{
    public function __invoke(string $entry, Entries $ecritures): EntryResource
    {
        return new EntryResource($ecritures->find($entry) ?? throw ErrorCode::EntryNotFound->problem());
    }
}
