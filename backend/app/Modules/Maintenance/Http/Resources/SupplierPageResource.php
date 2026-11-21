<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources;

use App\Modules\Maintenance\Models\SupplierProfile;
use App\Modules\Parties\Data\PartyData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, SupplierProfile> $resource
 */
final class SupplierPageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, SupplierProfile>  $page
     * @param  array<string, PartyData>  $parties
     */
    public function __construct(CursorPaginator $page, private readonly array $parties)
    {
        parent::__construct($page);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_values($this->resource->getCollection()->map(fn (SupplierProfile $s): array => (new SupplierResource($s, $this->parties[$s->party_id] ?? null))->toArray($request))->all());
    }
}
