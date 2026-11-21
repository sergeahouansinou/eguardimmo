<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Http\Resources\PayoutEvaluationResource;
use App\Modules\OwnerFunds\Support\Mandants;
use App\Modules\OwnerFunds\Support\PayoutEvaluator;
use Carbon\CarbonImmutable;

final class ShowMandantAccountController
{
    public function __invoke(string $mandant, Mandants $mandants, PayoutEvaluator $evaluateur, OrganizationDirectory $organisations): PayoutEvaluationResource
    {
        $mandants->assertExists($mandant);

        return new PayoutEvaluationResource($evaluateur->evaluate($mandant, CarbonImmutable::today()), $organisations->currency()->getCode());
    }
}
