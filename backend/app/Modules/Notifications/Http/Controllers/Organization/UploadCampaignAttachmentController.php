<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Actions\AddCampaignAttachment;
use App\Modules\Notifications\Http\Requests\UploadCampaignAttachmentRequest;
use App\Modules\Notifications\Http\Resources\CampaignAttachmentResource;
use Illuminate\Http\JsonResponse;

final class UploadCampaignAttachmentController
{
    public function __invoke(UploadCampaignAttachmentRequest $request, string $campaign, AddCampaignAttachment $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return (new CampaignAttachmentResource($action->handle($user, $campaign, $request->document())))->response()->setStatusCode(201);
    }
}
