<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\AmendMandateTerms;
use App\Modules\Mandates\Http\Requests\AmendMandateTermsRequest;
use App\Modules\Mandates\Http\Resources\MandateResource;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Queries\MandateViews;

final class AmendMandateTermsController
{
    public function __invoke(string $mandate, AmendMandateTermsRequest $request, Mandates $mandats, AmendMandateTerms $avenant, MandateViews $views): MandateResource
    {
        $courant = $mandats->get($mandate);
        $avenant->handle($courant, $request->toData());

        return new MandateResource($views->find($courant->id));
    }
}
