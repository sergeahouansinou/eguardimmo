<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Controllers\Organization;

use App\Modules\Documents\Actions\CreateCertificate;
use App\Modules\Documents\Http\Requests\CreateCertificateRequest;
use App\Modules\Documents\Http\Resources\CertificateResource;
use Illuminate\Http\JsonResponse;

final class CreateCertificateController
{
    public function __invoke(CreateCertificateRequest $request, CreateCertificate $creer): JsonResponse
    {
        return (new CertificateResource($creer->handle($request->toData())))->response()->setStatusCode(201);
    }
}
