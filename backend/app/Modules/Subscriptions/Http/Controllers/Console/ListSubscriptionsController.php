<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Http\Controllers\Console;

use App\Modules\Subscriptions\Http\Requests\ListSubscriptionsRequest;
use App\Modules\Subscriptions\Http\Resources\Console\SubscriptionResource;
use App\Modules\Subscriptions\Queries\SubscriptionList;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListSubscriptionsController
{
    public function __invoke(ListSubscriptionsRequest $requete, SubscriptionList $abonnements): AnonymousResourceCollection
    {
        $page = $abonnements->page($requete->status(), $requete->plan(), $requete->trialEnding(), $requete->cursor(), $requete->perPage());

        return SubscriptionResource::collection($page->items())->additional(['meta' => [
            'has_more' => $page->hasMorePages(),
            'next_cursor' => $page->nextCursor()?->encode(),
            'mrr' => null,
            'arr' => null,
        ]]);
    }
}
