<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Organization;

use App\Modules\Notifications\Http\Resources\CampaignResource;
use App\Modules\Notifications\Queries\Campaigns;

final class ShowCampaignController
{
    public function __invoke(string $campaign, Campaigns $campagnes): CampaignResource
    {
        return new CampaignResource($campagnes->find($campaign));
    }
}
