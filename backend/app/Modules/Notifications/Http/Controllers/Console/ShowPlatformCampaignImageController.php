<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Console;

use App\Modules\Notifications\Actions\StreamPlatformCampaignImage;
use Illuminate\Http\Response;

final class ShowPlatformCampaignImageController
{
    public function __invoke(string $campaign, string $image, StreamPlatformCampaignImage $action): Response
    {
        return $action->handle($campaign, $image);
    }
}
