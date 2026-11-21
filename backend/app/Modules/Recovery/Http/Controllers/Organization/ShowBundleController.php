<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Http\Resources\BundleResource;
use App\Modules\Recovery\Queries\Bundles;

final class ShowBundleController
{
    public function __invoke(string $bundle, Bundles $envois): BundleResource
    {
        return new BundleResource($envois->get($bundle));
    }
}
