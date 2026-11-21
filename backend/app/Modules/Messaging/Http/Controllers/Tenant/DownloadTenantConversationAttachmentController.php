<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Queries\TenantThreads;
use App\Modules\Messaging\Queries\ThreadAttachments;
use App\Modules\Messaging\Support\AttachmentStreams;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadTenantConversationAttachmentController
{
    public function __invoke(Request $request, string $attachment, ThreadAttachments $pieces, TenantThreads $fils, AttachmentStreams $flux): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $piece = $pieces->find($attachment);

        if ($piece === null || $fils->find($user->id, (string) $piece->getAttribute('conversation_id'), CarbonImmutable::today()) === null) {
            throw ErrorCode::AttachmentNotFound->problem();
        }

        return $flux->stream($piece);
    }
}
