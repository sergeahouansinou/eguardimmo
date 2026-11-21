<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Actions\StreamAnnouncementAttachment;
use App\Modules\Notifications\Enums\CampaignAudience;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadTenantAnnouncementAttachmentController
{
    public function __invoke(Request $request, string $campaign, string $attachment, StreamAnnouncementAttachment $action): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();

        return $action->handle($user->id, CampaignAudience::Tenants, $campaign, $attachment);
    }
}
