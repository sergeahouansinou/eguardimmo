<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Reporting\Actions\MarkReportRead;
use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Http\Resources\Owner\OwnerReportResource;
use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Queries\OwnerReports;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\Request;

final class MarkOwnerReportReadController
{
    public function __invoke(string $report, Request $request, MandateDirectory $mandats, OwnerReports $rapports, OrganizationDirectory $organisations, CurrentOrganization $contexte, MarkReportRead $action): OwnerReportResource
    {
        /** @var User $user */
        $user = $request->user();
        $portee = $mandats->ownerScope($user->id);
        $rapport = $rapports->find($portee, $report) ?? throw ErrorCode::OwnerReportNotFound->problem();
        $mandats->assertOwnerWritable($portee->visible($rapport->organization_id, $rapport->mandant_party_id) ?? throw ErrorCode::OwnerReportNotFound->problem());

        $lu = $contexte->run($rapport->organization_id, fn (): ManagementReport => $action->handle($rapport, $user->id));

        return new OwnerReportResource(['report' => $lu, 'agency_name' => $organisations->names([$lu->organization_id])[$lu->organization_id] ?? null, 'detail' => false]);
    }
}
