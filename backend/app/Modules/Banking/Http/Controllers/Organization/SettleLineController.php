<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\SettleLine;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\SuggestionAction;
use App\Modules\Banking\Http\Requests\SettleLineRequest;
use App\Modules\Banking\Http\Resources\BankMatchResource;
use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Banking\Support\Actor;
use App\Modules\Banking\Support\IdempotencyHeader;
use Illuminate\Http\JsonResponse;

final class SettleLineController
{
    public function __invoke(SettleLineRequest $request, string $line, SettleLine $creation): JsonResponse
    {
        $v = $request->validated();
        $action = SuggestionAction::from((string) $v['action']);
        $cibles = match ($action) {
            SuggestionAction::SettleLease => array_map(static fn (array $a): array => ['id' => (string) $a['lease_id'], 'amount' => (int) $a['amount']], array_values($v['allocations'])),
            SuggestionAction::SettleInvoice => [['id' => (string) $v['invoice_id'], 'amount' => isset($v['amount']) ? (int) $v['amount'] : $this->amountOf($line)]],
            default => [],
        };
        $resultat = $creation->handle($line, $action, $cibles, (int) $v['lock_version'], Actor::id($request), IdempotencyHeader::read($request));

        return (new BankMatchResource($resultat['match']->load('items')))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }

    private function amountOf(string $line): int
    {
        $ligne = BankStatementLine::query()->find($line) ?? throw ErrorCode::LineNotFound->problem();

        return (int) $ligne->amount->getAmount();
    }
}
