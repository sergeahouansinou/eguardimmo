<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Models\SupportAttachment;
use App\Modules\Messaging\Models\SupportTicket;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class TicketLoader
{
    private const RELATIONS = ['requester', 'assignee', 'messages.author', 'messages.attachments', 'accessGrants'];

    public static function forRequester(Request $request, string $id): SupportTicket
    {
        return SupportTicket::query()
            ->where('requester_user_id', $request->user()?->getAuthIdentifier())
            ->with(self::RELATIONS)
            ->find($id) ?? throw ErrorCode::TicketNotFound->problem();
    }

    public static function forSupport(string $id): SupportTicket
    {
        return SupportTicket::query()->with(self::RELATIONS)->find($id) ?? throw ErrorCode::TicketNotFound->problem();
    }

    public static function download(Request $request, string $id, bool $vueSupport): StreamedResponse
    {
        $piece = SupportAttachment::query()->with('message.ticket')->find($id);
        $message = $piece?->message;
        $autorise = $message !== null && ($vueSupport || (! $message->internal && $message->ticket->requester_user_id === $request->user()?->getAuthIdentifier()));

        if ($piece === null || ! $autorise || ! AttachmentStore::exists($piece->path)) {
            throw ErrorCode::AttachmentNotFound->problem();
        }

        return AttachmentStore::response($piece->path, $piece->original_name, $piece->mime_type);
    }
}
