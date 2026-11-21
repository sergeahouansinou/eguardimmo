<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Organization;

use App\Modules\Notifications\Http\Requests\ListCampaignsRequest;
use App\Modules\Notifications\Http\Resources\CampaignResource;
use App\Modules\Notifications\Queries\Campaigns;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListCampaignsController
{
    public function __invoke(ListCampaignsRequest $request, Campaigns $campagnes): AnonymousResourceCollection
    {
        return CampaignResource::collection($campagnes->page($request->toData(), $request->cursor(), $request->perPage()))
            ->additional(['counts' => $campagnes->counts(), 'stats' => $campagnes->stats()]);
    }
}
