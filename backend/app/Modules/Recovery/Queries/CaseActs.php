<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Queries;

use App\Modules\Recovery\Models\RecoveryAct;
use App\Modules\Recovery\Models\RecoveryCase;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;

final readonly class CaseActs
{
    /**
     * @return CursorPaginator<int, RecoveryAct>
     */
    public function page(RecoveryCase $dossier, int $parPage, ?string $cursor): CursorPaginator
    {
        return RecoveryAct::query()
            ->where('case_id', $dossier->id)
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $cursor === null ? null : Cursor::fromEncoded($cursor));
    }
}
