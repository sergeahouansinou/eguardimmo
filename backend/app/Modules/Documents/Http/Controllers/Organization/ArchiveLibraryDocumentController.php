<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Controllers\Organization;

use App\Modules\Documents\Actions\ArchiveLibraryDocument;
use App\Modules\Documents\Http\Resources\LibraryDocumentResource;

final class ArchiveLibraryDocumentController
{
    public function __invoke(string $entry, ArchiveLibraryDocument $archiver): LibraryDocumentResource
    {
        return new LibraryDocumentResource($archiver->handle($entry, true));
    }
}
