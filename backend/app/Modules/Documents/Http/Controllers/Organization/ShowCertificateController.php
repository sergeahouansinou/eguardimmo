<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Controllers\Organization;

use App\Modules\Documents\Http\Resources\CertificateResource;
use App\Modules\Documents\Queries\Certificates;

final class ShowCertificateController
{
    public function __invoke(string $certificate, Certificates $pieces): CertificateResource
    {
        return new CertificateResource($pieces->get($certificate));
    }
}
