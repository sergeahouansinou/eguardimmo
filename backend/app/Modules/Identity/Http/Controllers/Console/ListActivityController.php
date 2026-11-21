<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers\Console;

use App\Modules\Identity\Http\Requests\ListActivityRequest;
use App\Modules\Identity\Http\Resources\ActivityResource;
use App\Modules\Identity\Queries\ActivityLog;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListActivityController
{
    public function __invoke(ListActivityRequest $request, ActivityLog $journal, RecordAudit $audit): AnonymousResourceCollection
    {
        $filtres = $request->toData();
        $page = $journal->list($filtres, (string) $request->user()?->getAuthIdentifier());

        $audit->handle('console.activity.listed', metadata: $filtres->toAuditMetadata());

        return ActivityResource::collection($page);
    }
}
