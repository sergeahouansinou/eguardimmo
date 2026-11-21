<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Accounting\Enums\Side;
use App\Modules\Accounting\PublicApi\BankBook;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Http\Requests\ListBookLinesRequest;
use App\Modules\Banking\Http\Resources\BookLineResource;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Queries\UnmatchedBookLines;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class ListBookLinesController
{
    public function __invoke(ListBookLinesRequest $request, UnmatchedBookLines $ecritures, BankBook $livre): JsonResponse
    {
        $v = $request->validated();
        $compte = OrganizationBankAccount::query()->find((string) $v['account_id']) ?? throw ErrorCode::AccountNotFound->problem();

        if (isset($v['cursor']) && ! $livre->isValidCursor((string) $v['cursor'])) {
            throw ErrorCode::CursorInvalid->problem();
        }

        $page = $ecritures->page(
            $compte, isset($v['from']) ? CarbonImmutable::parse((string) $v['from']) : null, isset($v['to']) ? CarbonImmutable::parse((string) $v['to']) : null,
            isset($v['amount']) ? (int) $v['amount'] : null, isset($v['side']) ? Side::from((string) $v['side']) : null, isset($v['cursor']) ? (string) $v['cursor'] : null, (int) ($v['limit'] ?? 50),
        );

        return BookLineResource::collection($page['lines'])->additional(['meta' => ['next_cursor' => $page['next_cursor']]])->response();
    }
}
