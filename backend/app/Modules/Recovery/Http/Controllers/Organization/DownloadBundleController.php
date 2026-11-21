<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Actions\DownloadBundle;
use App\Modules\Recovery\Queries\Bundles;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadBundleController
{
    public function __invoke(string $bundle, Bundles $envois, DownloadBundle $telechargement): StreamedResponse
    {
        return $telechargement->handle($envois->get($bundle));
    }
}
