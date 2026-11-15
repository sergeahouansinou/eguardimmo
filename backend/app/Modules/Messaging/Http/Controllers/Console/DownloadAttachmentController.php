<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Messaging\Support\TicketLoader;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadAttachmentController
{
    public function __invoke(Request $request, string $attachment): StreamedResponse
    {
        return TicketLoader::download($request, $attachment, vueSupport: true);
    }
}
