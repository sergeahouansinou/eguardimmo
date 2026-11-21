<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\UndoMatch;
use App\Modules\Banking\Http\Requests\UndoMatchRequest;
use App\Modules\Banking\Http\Resources\BankMatchResource;
use App\Modules\Banking\Support\Actor;

final class UndoMatchController
{
    public function __invoke(UndoMatchRequest $request, string $match, UndoMatch $annulation): BankMatchResource
    {
        return new BankMatchResource($annulation->handle($match, trim((string) $request->validated('reason')), Actor::id($request))->load('items'));
    }
}
