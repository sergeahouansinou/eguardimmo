<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Actions\ScheduleCampaign;
use App\Modules\Notifications\Http\Requests\ScheduleCampaignRequest;
use App\Modules\Notifications\Http\Resources\CampaignResource;
use App\Modules\Notifications\Queries\Campaigns;

final class ScheduleCampaignController
{
    public function __invoke(ScheduleCampaignRequest $request, string $campaign, ScheduleCampaign $action, Campaigns $campagnes): CampaignResource
    {
        /** @var User $user */
        $user = $request->user();
        $action->handle($user, $campaign, $request->scheduledAt());

        return new CampaignResource($campagnes->find($campaign));
    }
}
