<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Console;

use App\Modules\Notifications\Actions\TestPlatformCampaign;
use App\Modules\Notifications\Http\Resources\Console\PlatformCampaignTestResource;
use Illuminate\Http\Request;

final class TestPlatformCampaignController
{
    public function __invoke(Request $requete, string $campaign, TestPlatformCampaign $action): PlatformCampaignTestResource
    {
        return new PlatformCampaignTestResource($action->handle($campaign, (string) $requete->user()?->getAuthIdentifier()));
    }
}
