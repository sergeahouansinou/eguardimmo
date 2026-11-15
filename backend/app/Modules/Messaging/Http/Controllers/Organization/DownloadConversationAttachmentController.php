<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Messaging\Support\ConversationLoader;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadConversationAttachmentController
{
    public function __invoke(Request $request, string $attachment): StreamedResponse
    {
        return ConversationLoader::download($request, $attachment);
    }
}
