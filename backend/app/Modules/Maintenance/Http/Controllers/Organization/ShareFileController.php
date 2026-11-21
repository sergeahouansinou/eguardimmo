<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\ShareFile;
use App\Modules\Maintenance\Http\Requests\ShareFileRequest;
use App\Modules\Maintenance\Http\Resources\FileResource;

final class ShareFileController
{
    public function __invoke(string $intervention, string $file, ShareFileRequest $request, ShareFile $action): FileResource
    {
        return new FileResource($action->handle($intervention, $file, $request->visibleToOwner()));
    }
}
