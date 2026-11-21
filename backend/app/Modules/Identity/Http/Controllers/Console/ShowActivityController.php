<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers\Console;

use App\Modules\Identity\Http\Resources\ActivityResource;
use App\Modules\Identity\Queries\ActivityLog;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Request;

final class ShowActivityController
{
    public function __invoke(Request $request, string $activity, ActivityLog $journal, RecordAudit $audit): ActivityResource
    {
        $entree = $journal->find($activity, (string) $request->user()?->getAuthIdentifier());

        $audit->handle('console.activity.viewed', metadata: ['audit_log_id' => $entree->id]);

        return new ActivityResource($entree);
    }
}
