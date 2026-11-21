<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Reporting\Actions\UpdateForecastAssumptions;
use App\Modules\Reporting\Http\Requests\UpdateForecastAssumptionsRequest;
use App\Modules\Reporting\Support\Finance\AssumptionsView;
use Illuminate\Http\JsonResponse;

final class UpdateForecastAssumptionsController
{
    public function __invoke(UpdateForecastAssumptionsRequest $request, UpdateForecastAssumptions $mise, OrganizationDirectory $organisations): JsonResponse
    {
        $enregistrees = $mise->handle($request->assumptions());

        return response()->json(['data' => AssumptionsView::of($enregistrees, $organisations->currency()->getCode())]);
    }
}
