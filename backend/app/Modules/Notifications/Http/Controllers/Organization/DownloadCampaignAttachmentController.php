<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Organization;

use App\Modules\Notifications\Actions\StreamCampaignAttachment;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadCampaignAttachmentController
{
    public function __invoke(string $campaign, string $attachment, StreamCampaignAttachment $action): StreamedResponse
    {
        return $action->handle($campaign, $attachment);
    }
}
