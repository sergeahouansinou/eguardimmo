<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Queries\OwnerThreads;
use App\Modules\Messaging\Queries\ThreadAttachments;
use App\Modules\Messaging\Support\AttachmentStreams;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadOwnerConversationAttachmentController
{
    public function __invoke(Request $request, string $attachment, ThreadAttachments $pieces, OwnerThreads $fils, AttachmentStreams $flux): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $piece = $pieces->find($attachment);

        if ($piece === null || $fils->find($fils->visibles($user->id), (string) $piece->getAttribute('conversation_id')) === null) {
            throw ErrorCode::AttachmentNotFound->problem();
        }

        return $flux->stream($piece);
    }
}
