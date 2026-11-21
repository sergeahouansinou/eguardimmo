<?php

declare(strict_types=1);

namespace App\Modules\Charges\Queries;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\ChargeStatementFile;
use App\Modules\Charges\Models\ChargeStatementLine;
use App\Modules\Charges\Models\ChargeStatementPlan;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final readonly class Statements
{
    public function get(string $id): ChargeStatement
    {
        return (Str::isUuid($id) ? ChargeStatement::query()->find($id) : null) ?? throw ErrorCode::StatementNotFound->problem();
    }

    /**
     * @return Collection<int, ChargeStatementLine>
     */
    public function lines(ChargeStatement $decompte): Collection
    {
        return ChargeStatementLine::query()->where('statement_id', $decompte->id)->orderBy('position')->get();
    }

    /**
     * @return Collection<int, ChargeStatementFile>
     */
    public function files(ChargeStatement $decompte): Collection
    {
        return ChargeStatementFile::query()->where('statement_id', $decompte->id)->orderBy('id')->get();
    }

    public function plan(ChargeStatement $decompte): ?ChargeStatementPlan
    {
        return ChargeStatementPlan::query()->where('statement_id', $decompte->id)->first();
    }

    /**
     * @return Collection<int, ChargeStatement>
     */
    public function ofExercise(string $exerciseId, int $limite): Collection
    {
        return ChargeStatement::query()->where('exercise_id', $exerciseId)->orderBy('lease_id')->orderBy('id')->limit($limite + 1)->get();
    }
}
