<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Console;

use App\Modules\Notifications\Actions\CreatePlatformCampaign;
use App\Modules\Notifications\Http\Requests\Console\SavePlatformCampaignRequest;
use App\Modules\Notifications\Http\Resources\Console\PlatformCampaignResource;
use App\Modules\Notifications\Support\PlatformCampaignView;
use Illuminate\Http\JsonResponse;

final class CreatePlatformCampaignController
{
    public function __invoke(SavePlatformCampaignRequest $requete, CreatePlatformCampaign $action, PlatformCampaignView $vue): JsonResponse
    {
        $enregistree = $action->handle($requete->toData(), (string) $requete->user()?->getAuthIdentifier());

        return (new PlatformCampaignResource($vue->detail($enregistree->campaignId)))
            ->additional(['meta' => ['unknown_recipients' => $enregistree->unknownRecipients]])
            ->response()->setStatusCode(201);
    }
}
