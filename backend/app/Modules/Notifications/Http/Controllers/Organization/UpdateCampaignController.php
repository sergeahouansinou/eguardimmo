<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Actions\UpdateCampaign;
use App\Modules\Notifications\Http\Requests\SaveCampaignRequest;
use App\Modules\Notifications\Http\Resources\CampaignResource;
use App\Modules\Notifications\Queries\Campaigns;

final class UpdateCampaignController
{
    public function __invoke(SaveCampaignRequest $request, string $campaign, UpdateCampaign $action, Campaigns $campagnes): CampaignResource
    {
        /** @var User $user */
        $user = $request->user();
        $action->handle($user, $campaign, $request->toData(), $request->version());

        return new CampaignResource($campagnes->find($campaign));
    }
}
