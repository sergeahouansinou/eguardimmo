<?php

declare(strict_types=1);

namespace App\Modules\Operations\Http\Controllers\Console;

use App\Modules\Operations\Http\Requests\ListBackupsRequest;
use App\Modules\Operations\Http\Resources\Console\BackupReportResource;
use App\Modules\Operations\Queries\BackupReports;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListBackupsController
{
    public function __invoke(ListBackupsRequest $requete, BackupReports $rapports): AnonymousResourceCollection
    {
        $page = $rapports->page($requete->kind(), $requete->succeeded(), $requete->cursor(), $requete->perPage());

        return BackupReportResource::collection($page->items())->additional(['meta' => [
            'has_more' => $page->hasMorePages(),
            'next_cursor' => $page->nextCursor()?->encode(),
            'max_age_hours' => (int) config('operations.backup_max_age_hours'),
            'last_success_at' => $rapports->lastSuccesses(),
        ]]);
    }
}
