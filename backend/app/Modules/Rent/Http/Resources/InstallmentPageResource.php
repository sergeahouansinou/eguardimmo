<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Resources;

use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Support\InstallmentView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\CursorPaginator;

/**
 * @property CursorPaginator<int, Installment> $resource
 */
final class InstallmentPageResource extends ResourceCollection
{
    /**
     * @param  CursorPaginator<int, Installment>  $page
     */
    public function __construct(CursorPaginator $page, private readonly InstallmentView $vue)
    {
        parent::__construct($page);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_values($this->resource->getCollection()->map(fn (Installment $e): array => (new InstallmentResource($e, $this->vue))->toArray($request))->all());
    }
}
