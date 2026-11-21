<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Resources\Owner;

use App\Modules\Reporting\Models\ManagementReport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, ManagementReport> $resource
 */
final class OwnerReportPageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, ManagementReport>  $page
     * @param  array<string, string|null>  $agences  nom de l'agence par organisation
     */
    public function __construct(CursorPaginator $page, private readonly array $agences)
    {
        parent::__construct($page);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_map(
            fn (ManagementReport $r): array => (new OwnerReportResource(['report' => $r, 'agency_name' => $this->agences[$r->organization_id] ?? null, 'detail' => false]))->toArray($request),
            array_values($this->resource->items()),
        );
    }
}
