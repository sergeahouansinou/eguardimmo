<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Console;

use App\Modules\Organizations\Data\ConsoleOrganizationData;
use App\Modules\Organizations\Data\ConsoleOrganizationFilters;
use App\Modules\Organizations\Http\Requests\ListConsoleOrganizationsRequest;
use App\Modules\Organizations\Http\Resources\Console\ConsoleOrganizationResource;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Queries\ConsoleOrganizations;
use App\Modules\Subscriptions\PublicApi\SubscriptionDirectory;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListConsoleOrganizationsController
{
    public function __invoke(ListConsoleOrganizationsRequest $requete, ConsoleOrganizations $organisations, SubscriptionDirectory $abonnements): AnonymousResourceCollection
    {
        $restreintes = $requete->plan() === null && $requete->subscriptionStatus() === null
            ? null
            : $abonnements->organizationIdsWhere($requete->plan(), $requete->subscriptionStatus());

        $page = $organisations->page(new ConsoleOrganizationFilters(
            $requete->kind(), $requete->state(), $requete->search(), $restreintes, $requete->cursor(), $requete->perPage(),
        ));
        $lignes = collect($page->items());
        $ids = array_values($lignes->map(fn (Organization $o): string => $o->id)->all());
        $effectifs = $organisations->activeMemberCounts($ids);
        $resumes = $abonnements->summaries($ids);

        return ConsoleOrganizationResource::collection($lignes->map(
            fn (Organization $o): ConsoleOrganizationData => $organisations->data($o, $effectifs[$o->id] ?? 0, $resumes[$o->id]->planCode ?? null, $resumes[$o->id]->status ?? null),
        ))->additional(['meta' => [
            'has_more' => $page->hasMorePages(),
            'next_cursor' => $page->nextCursor()?->encode(),
        ]]);
    }
}
