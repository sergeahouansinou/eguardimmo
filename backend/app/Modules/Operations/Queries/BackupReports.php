<?php

declare(strict_types=1);

namespace App\Modules\Operations\Queries;

use App\Modules\Operations\Enums\BackupKind;
use App\Modules\Operations\Models\BackupReport;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Support\Carbon;

final class BackupReports
{
    /**
     * @return CursorPaginator<int, BackupReport>
     */
    public function page(?BackupKind $type, ?bool $reussie, ?string $curseur, int $parPage): CursorPaginator
    {
        return BackupReport::query()
            ->when($type !== null, fn (Builder $q): Builder => $q->where('kind', $type))
            ->when($reussie !== null, fn (Builder $q): Builder => $q->where('succeeded', $reussie))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    /**
     * @return array<string, string|null> dernière sauvegarde réussie par type
     */
    public function lastSuccesses(): array
    {
        $derniers = [];

        foreach ([BackupKind::Database, BackupKind::Documents] as $type) {
            $date = BackupReport::query()->where('kind', $type)->where('succeeded', true)->max('started_at');
            $derniers[$type->value] = is_string($date) ? Carbon::parse($date)->toIso8601String() : null;
        }

        return $derniers;
    }
}
