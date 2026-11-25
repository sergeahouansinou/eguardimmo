<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Console;

use App\Modules\Notifications\Actions\UpdatePlatformCampaign;
use App\Modules\Notifications\Http\Requests\Console\SavePlatformCampaignRequest;
use App\Modules\Notifications\Http\Resources\Console\PlatformCampaignResource;
use App\Modules\Notifications\Support\PlatformCampaignView;
use Illuminate\Http\Resources\Json\JsonResource;

final class UpdatePlatformCampaignController
{
    public function __invoke(SavePlatformCampaignRequest $requete, string $campaign, UpdatePlatformCampaign $action, PlatformCampaignView $vue): JsonResource
    {
        $enregistree = $action->handle($campaign, $requete->toData(), (string) $requete->user()?->getAuthIdentifier());

        return (new PlatformCampaignResource($vue->detail($enregistree->campaignId)))
            ->additional(['meta' => ['unknown_recipients' => $enregistree->unknownRecipients]]);
    }
}
