<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Actions\StartCampaign;
use App\Modules\Notifications\Http\Resources\CampaignResource;
use App\Modules\Notifications\Queries\Campaigns;
use Illuminate\Http\Request;

final class SendCampaignController
{
    public function __invoke(Request $request, string $campaign, StartCampaign $action, Campaigns $campagnes): CampaignResource
    {
        /** @var User $user */
        $user = $request->user();
        $action->handle($campaign, $user->id);

        return new CampaignResource($campagnes->find($campaign));
    }
}
