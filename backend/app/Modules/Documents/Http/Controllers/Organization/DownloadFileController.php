<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Controllers\Organization;

use App\Modules\Documents\Actions\StreamFile;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadFileController
{
    public function __invoke(string $file, StreamFile $lire): StreamedResponse
    {
        return $lire->handle($file, generic: true);
    }
}
