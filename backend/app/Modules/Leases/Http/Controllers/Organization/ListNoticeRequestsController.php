<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Http\Requests\ListNoticeRequestsRequest;
use App\Modules\Leases\Http\Resources\NoticeRequestResource;
use App\Modules\Leases\Queries\NoticeRequests;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListNoticeRequestsController
{
    public function __invoke(ListNoticeRequestsRequest $request, NoticeRequests $demandes): AnonymousResourceCollection
    {
        return NoticeRequestResource::collection($demandes->page($request->status(), $request->perPage(), $request->cursor()));
    }
}
