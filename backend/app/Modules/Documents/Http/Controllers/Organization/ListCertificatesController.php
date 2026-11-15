<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Controllers\Organization;

use App\Modules\Documents\Http\Requests\ListCertificatesRequest;
use App\Modules\Documents\Http\Resources\CertificateResource;
use App\Modules\Documents\Queries\Certificates;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListCertificatesController
{
    public function __invoke(ListCertificatesRequest $request, Certificates $pieces): AnonymousResourceCollection
    {
        return CertificateResource::collection($pieces->list($request->filters(), $request->perPage()));
    }
}
