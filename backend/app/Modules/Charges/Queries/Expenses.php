<?php

declare(strict_types=1);

namespace App\Modules\Charges\Queries;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Models\Expense;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

final readonly class Expenses
{
    /**
     * @param  array{property_id: string|null, unit_id: string|null, status: string|null, settlement: string|null, from: string|null, to: string|null}  $filtres
     * @return CursorPaginator<int, Expense>
     */
    public function page(array $filtres, ?string $curseur, int $parPage): CursorPaginator
    {
        return Expense::query()
            ->when($filtres['property_id'] !== null, fn (Builder $q) => $q->where('property_id', $filtres['property_id']))
            ->when($filtres['unit_id'] !== null, fn (Builder $q) => $q->where('unit_id', $filtres['unit_id']))
            ->when($filtres['status'] !== null, fn (Builder $q) => $q->where('status', $filtres['status']))
            ->when($filtres['settlement'] !== null, fn (Builder $q) => $q->where('settlement', $filtres['settlement']))
            ->when($filtres['from'] !== null, fn (Builder $q) => $q->where('document_on', '>=', $filtres['from']))
            ->when($filtres['to'] !== null, fn (Builder $q) => $q->where('document_on', '<', $filtres['to']))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function get(string $id): Expense
    {
        return (Str::isUuid($id) ? Expense::query()->find($id) : null) ?? throw ErrorCode::ExpenseNotFound->problem();
    }

    /**
     * @return list<string> pièces de la dépense, la plus ancienne d'abord
     */
    public function files(Expense $depense): array
    {
        return array_values(array_map(fn (mixed $id): string => (string) $id, $depense->files()->orderBy('id')->pluck('stored_file_id')->all()));
    }
}
