<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Http\Resources\NoticeRequestResource;
use App\Modules\Leases\Queries\NoticeRequests;

final class ShowNoticeRequestController
{
    public function __invoke(string $noticeRequest, NoticeRequests $demandes): NoticeRequestResource
    {
        return new NoticeRequestResource($demandes->get($noticeRequest));
    }
}
