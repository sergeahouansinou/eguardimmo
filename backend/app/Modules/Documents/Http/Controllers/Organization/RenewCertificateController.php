<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Controllers\Organization;

use App\Modules\Documents\Actions\RenewCertificate;
use App\Modules\Documents\Http\Requests\RenewCertificateRequest;
use App\Modules\Documents\Http\Resources\CertificateResource;
use Illuminate\Http\JsonResponse;

final class RenewCertificateController
{
    public function __invoke(string $certificate, RenewCertificateRequest $request, RenewCertificate $renouveler): JsonResponse
    {
        return (new CertificateResource($renouveler->handle($certificate, $request->toData())))->response()->setStatusCode(201);
    }
}
