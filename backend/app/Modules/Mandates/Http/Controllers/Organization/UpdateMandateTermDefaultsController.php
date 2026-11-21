<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\UpdateMandateTermDefaults;
use App\Modules\Mandates\Http\Requests\UpdateMandateTermDefaultsRequest;
use App\Modules\Mandates\Http\Resources\MandateTermDefaultsResource;

final class UpdateMandateTermDefaultsController
{
    public function __invoke(UpdateMandateTermDefaultsRequest $request, UpdateMandateTermDefaults $modification): MandateTermDefaultsResource
    {
        return new MandateTermDefaultsResource($modification->handle($request->toData()));
    }
}
