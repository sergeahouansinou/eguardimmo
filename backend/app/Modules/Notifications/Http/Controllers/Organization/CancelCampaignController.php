<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Actions\CancelCampaign;
use App\Modules\Notifications\Http\Resources\CampaignResource;
use App\Modules\Notifications\Queries\Campaigns;
use Illuminate\Http\Request;

final class CancelCampaignController
{
    public function __invoke(Request $request, string $campaign, CancelCampaign $action, Campaigns $campagnes): CampaignResource
    {
        /** @var User $user */
        $user = $request->user();
        $action->handle($user, $campaign);

        return new CampaignResource($campagnes->find($campaign));
    }
}
