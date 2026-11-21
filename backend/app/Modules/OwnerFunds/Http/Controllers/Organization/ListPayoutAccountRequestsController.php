<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Enums\PayoutAccountRequestStatus;
use App\Modules\OwnerFunds\Http\Requests\ListPageRequest;
use App\Modules\OwnerFunds\Http\Resources\PayoutAccountRequestResource;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\Parties\PublicApi\PartyBankAccounts;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListPayoutAccountRequestsController
{
    public function __invoke(ListPageRequest $request, PartyBankAccounts $comptes): AnonymousResourceCollection
    {
        $requete = PayoutAccountRequest::query()->orderByDesc('id');

        if ($request->filled('mandant')) {
            $requete->where('mandant_party_id', (string) $request->validated('mandant'));
        }

        $statut = PayoutAccountRequestStatus::tryFrom((string) $request->query('status', PayoutAccountRequestStatus::Pending->value));
        $requete->where('status', ($statut ?? PayoutAccountRequestStatus::Pending)->value);
        $page = $requete->cursorPaginate($request->perPage());
        $etats = $comptes->states(array_values(array_map(fn (PayoutAccountRequest $d): string => $d->bank_account_id, $page->items())));
        $page->setCollection($page->getCollection()->map(fn (PayoutAccountRequest $d): array => ['request' => $d, 'account' => $etats[$d->bank_account_id] ?? null]));

        return PayoutAccountRequestResource::collection($page);
    }
}
