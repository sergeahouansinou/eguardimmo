<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Http\Requests\ListReportsRequest;
use App\Modules\Reporting\Http\Resources\ManagementReportResource;
use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Queries\DueReports;
use Carbon\CarbonImmutable;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListReportsController
{
    private const int DUE_MAX = 50;

    public function __invoke(ListReportsRequest $request, DueReports $dus): AnonymousResourceCollection
    {
        $requete = ManagementReport::query()->orderByDesc('id');

        if ($request->filled('mandant')) {
            $requete->where('mandant_party_id', $request->string('mandant')->toString());
        }

        if ($request->filled('status')) {
            $requete->where('status', $request->string('status')->toString());
        }

        if ($request->filled('from')) {
            $requete->where('period_end', '>', $request->string('from')->toString());
        }

        if ($request->filled('to')) {
            $requete->where('period_start', '<=', $request->string('to')->toString());
        }

        $collection = ManagementReportResource::collection($requete->cursorPaginate($request->perPage()));

        if ($request->filled('cursor')) {
            return $collection;
        }

        $periode = DueReports::lastPeriod(CarbonImmutable::today());
        $ids = $dus->mandantIds($periode['from'], $periode['to']);

        return $collection->additional(['meta' => ['due' => ['period' => ['start' => $periode['from']->toDateString(), 'end' => $periode['to']->toDateString()], 'mandants' => $dus->named($ids, self::DUE_MAX)]]]);
    }
}
