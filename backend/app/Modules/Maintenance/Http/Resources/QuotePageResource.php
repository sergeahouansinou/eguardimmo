<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources;

use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Maintenance\Queries\QuoteLookups;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, InterventionQuote> $resource
 */
final class QuotePageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, InterventionQuote>  $page
     */
    public function __construct(CursorPaginator $page, private readonly QuoteLookups $liens)
    {
        parent::__construct($page);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_values($this->resource->getCollection()->map(fn (InterventionQuote $d): array => (new QuoteSummaryResource(
            $d,
            $this->liens->interventions[$d->intervention_id] ?? null,
            $this->liens->approvals[$d->id] ?? null,
        ))->toArray($request))->all());
    }
}
