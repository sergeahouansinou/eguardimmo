<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Console;

use App\Modules\Notifications\Actions\SendPlatformCampaign;
use App\Modules\Notifications\Http\Requests\Console\SendPlatformCampaignRequest;
use App\Modules\Notifications\Http\Resources\Console\PlatformCampaignResource;
use App\Modules\Notifications\Support\PlatformCampaignView;
use Illuminate\Http\JsonResponse;

final class SendPlatformCampaignController
{
    public function __invoke(SendPlatformCampaignRequest $requete, string $campaign, SendPlatformCampaign $action, PlatformCampaignView $vue): JsonResponse
    {
        $action->handle($campaign, $requete->lockVersion(), (string) $requete->user()?->getAuthIdentifier());

        return (new PlatformCampaignResource($vue->detail($campaign)))->response()->setStatusCode(202);
    }
}
