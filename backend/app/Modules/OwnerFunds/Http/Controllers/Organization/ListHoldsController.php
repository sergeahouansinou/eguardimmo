<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Http\Requests\ListPageRequest;
use App\Modules\OwnerFunds\Http\Resources\PayoutHoldResource;
use App\Modules\OwnerFunds\Models\PayoutHold;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListHoldsController
{
    public function __invoke(ListPageRequest $request): AnonymousResourceCollection
    {
        $requete = PayoutHold::query()->orderByDesc('id');

        if ($request->filled('mandant')) {
            $requete->where('mandant_party_id', (string) $request->validated('mandant'));
        }

        if ($request->boolean('active')) {
            $requete->whereNull('released_at');
        }

        return PayoutHoldResource::collection($requete->cursorPaginate($request->perPage()));
    }
}
