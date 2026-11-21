<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Http\Resources\BankStatementResource;
use App\Modules\Banking\Models\BankStatement;
use App\Modules\Banking\Support\StatementGaps;
use Illuminate\Http\JsonResponse;

final class ShowStatementController
{
    public function __invoke(string $statement, StatementGaps $trous): JsonResponse
    {
        $releve = BankStatement::query()->find($statement) ?? throw ErrorCode::StatementNotFound->problem();

        return (new BankStatementResource($releve))->additional(['meta' => ['gaps' => array_map(static fn ($t): array => [
            'previous_statement_id' => $t->previousStatementId, 'statement_id' => $t->statementId, 'expected_opening' => $t->expectedOpening, 'actual_opening' => $t->actualOpening,
        ], $trous->of($releve->bank_account_id))]])->response();
    }
}
