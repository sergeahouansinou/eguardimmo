<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Actions\SendCampaignTest;
use App\Modules\Notifications\Http\Requests\CampaignTestRequest;
use App\Modules\Notifications\Http\Resources\CampaignTestResource;

final class SendCampaignTestController
{
    public function __invoke(CampaignTestRequest $request, SendCampaignTest $action): CampaignTestResource
    {
        /** @var User $user */
        $user = $request->user();

        return new CampaignTestResource($action->handle($user, trim((string) $request->string('subject')), (string) $request->string('body'), $request->audience()));
    }
}
