<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Console;

use App\Modules\Notifications\Http\Requests\Console\ListPlatformCampaignsRequest;
use App\Modules\Notifications\Http\Resources\Console\PlatformCampaignSummaryResource;
use App\Modules\Notifications\Queries\PlatformCampaigns;
use App\Modules\Notifications\Support\PlatformCampaignView;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListPlatformCampaignsController
{
    public function __invoke(ListPlatformCampaignsRequest $requete, PlatformCampaigns $campagnes, PlatformCampaignView $vue): AnonymousResourceCollection
    {
        $page = $campagnes->page($requete->status(), $requete->cursor(), $requete->perPage());

        return PlatformCampaignSummaryResource::collection($vue->rows(array_values($page->items())))->additional(['meta' => [
            'has_more' => $page->hasMorePages(),
            'next_cursor' => $page->nextCursor()?->encode(),
        ]]);
    }
}
