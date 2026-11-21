<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Reporting\Http\Requests\ListOwnerReportsRequest;
use App\Modules\Reporting\Http\Resources\Owner\OwnerReportPageResource;
use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Queries\OwnerReports;

final class ListOwnerReportsController
{
    public function __invoke(ListOwnerReportsRequest $request, MandateDirectory $mandats, OwnerReports $rapports, OrganizationDirectory $organisations): OwnerReportPageResource
    {
        /** @var User $user */
        $user = $request->user();
        $portee = $mandats->ownerScope($user->id, $request->agency());
        $page = $rapports->page($portee, $request->perPage(), $request->cursor());
        $noms = $organisations->names(array_values(array_unique(array_map(fn (ManagementReport $r): string => $r->organization_id, $page->items()))));

        return new OwnerReportPageResource($page, $noms);
    }
}
