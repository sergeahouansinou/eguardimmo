<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Actions\AcknowledgeNoticeRequest;
use App\Modules\Leases\Http\Requests\AcknowledgeNoticeRequestRequest;
use App\Modules\Leases\Http\Resources\NoticeRequestResource;
use App\Modules\Leases\Queries\NoticeRequests;
use App\Modules\Leases\Support\ProofContexts;

final class AcknowledgeNoticeRequestController
{
    public function __invoke(string $noticeRequest, AcknowledgeNoticeRequestRequest $request, NoticeRequests $demandes, ProofContexts $contextes, AcknowledgeNoticeRequest $action): NoticeRequestResource
    {
        /** @var User $user */
        $user = $request->user();

        return new NoticeRequestResource($action->handle($demandes->get($noticeRequest), $user, $request->receivedOn(), $contextes->of($request)));
    }
}
