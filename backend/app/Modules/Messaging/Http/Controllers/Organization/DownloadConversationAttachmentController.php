<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Queries\ThreadAttachments;
use App\Modules\Messaging\Support\AttachmentStreams;
use App\Modules\Messaging\Support\ConversationLoader;
use App\Modules\Messaging\Support\StaffAccess;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadConversationAttachmentController
{
    public function __invoke(Request $request, string $attachment, ThreadAttachments $pieces, AttachmentStreams $flux, StaffAccess $acces): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $piece = $pieces->find($attachment);
        $fil = $piece === null ? null : Conversation::query()->find((string) $piece->getAttribute('conversation_id'));

        if ($piece === null || $fil === null || ! $fil->kind->isExternal()) {
            return ConversationLoader::download($request, $attachment);
        }

        $acces->assertExternal($user, $fil->kind);

        return $flux->stream($piece);
    }
}
