<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Actions\RemoveCampaignAttachment;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class DeleteCampaignAttachmentController
{
    public function __invoke(Request $request, string $campaign, string $attachment, RemoveCampaignAttachment $action): Response
    {
        /** @var User $user */
        $user = $request->user();
        $action->handle($user, $campaign, $attachment);

        return new Response(null, 204);
    }
}
