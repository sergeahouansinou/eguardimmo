<?php

declare(strict_types=1);

namespace App\Modules\Charges\Queries;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\StatementStatus;
use App\Modules\Charges\Models\ChargeConsumption;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeItem;
use App\Modules\Charges\Models\ChargeItemSource;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\ChargeStatementLine;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final readonly class Exercises
{
    /**
     * @param  array{property_id: string|null, status: string|null}  $filtres
     * @return CursorPaginator<int, ChargeExercise>
     */
    public function page(array $filtres, ?string $curseur, int $parPage): CursorPaginator
    {
        return ChargeExercise::query()
            ->when($filtres['property_id'] !== null, fn (Builder $q) => $q->where('property_id', $filtres['property_id']))
            ->when($filtres['status'] !== null, fn (Builder $q) => $q->where('status', $filtres['status']))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function get(string $id): ChargeExercise
    {
        return (Str::isUuid($id) ? ChargeExercise::query()->find($id) : null) ?? throw ErrorCode::ExerciseNotFound->problem();
    }

    public function view(ChargeExercise $exercice): ExerciseView
    {
        $postes = ChargeItem::query()->where('exercise_id', $exercice->id)->orderBy('position')->get();
        $ids = $postes->pluck('id')->all();
        $decomptes = ChargeStatement::query()->where('exercise_id', $exercice->id)->orderBy('lease_id')->orderBy('id')->get();
        $sources = [];
        $consommations = [];

        foreach (ChargeItemSource::query()->whereIn('item_id', $ids)->orderBy('id')->get() as $source) {
            $sources[$source->item_id][] = $source;
        }

        foreach (ChargeConsumption::query()->whereIn('item_id', $ids)->orderBy('unit_id')->get() as $consommation) {
            $consommations[$consommation->item_id][] = $consommation;
        }

        return new ExerciseView(
            $exercice,
            $postes,
            $sources,
            $consommations,
            $decomptes,
            $this->ownerShares($postes, array_values(array_map(strval(...), $decomptes->where('status', '!=', StatementStatus::Superseded)->pluck('id')->all()))),
        );
    }

    /**
     * @param  Collection<int, ChargeItem>  $postes
     * @param  list<string>  $decompteIds
     * @return array<string, int>
     */
    private function ownerShares(Collection $postes, array $decompteIds): array
    {
        $parts = $decompteIds === [] ? collect() : ChargeStatementLine::query()->whereIn('statement_id', $decompteIds)->selectRaw('item_id, SUM(share) as total')->groupBy('item_id')->pluck('total', 'item_id');
        $resultat = [];

        foreach ($postes as $poste) {
            $resultat[$poste->id] = (int) $poste->amount->getAmount() - (int) ($parts[$poste->id] ?? 0);
        }

        return $resultat;
    }
}
