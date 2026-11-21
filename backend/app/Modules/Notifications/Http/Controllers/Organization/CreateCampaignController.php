<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Actions\CreateCampaign;
use App\Modules\Notifications\Http\Requests\SaveCampaignRequest;
use App\Modules\Notifications\Http\Resources\CampaignResource;
use App\Modules\Notifications\Queries\Campaigns;
use Illuminate\Http\JsonResponse;

final class CreateCampaignController
{
    public function __invoke(SaveCampaignRequest $request, CreateCampaign $action, Campaigns $campagnes): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $campagne = $action->handle($user, $request->toData());

        return (new CampaignResource($campagnes->find($campagne->id)))->response()->setStatusCode(201);
    }
}
