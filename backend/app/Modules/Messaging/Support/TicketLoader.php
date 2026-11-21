<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Models\SupportAttachment;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Models\SupportTicketMessage;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class TicketLoader
{
    public const int FIL_MAX = 200;

    public static function forRequester(Request $request, string $id): SupportTicket
    {
        $ticket = SupportTicket::query()
            ->where('requester_user_id', $request->user()?->getAuthIdentifier())
            ->with(['requester', 'assignee', 'messages' => self::borne(true), 'messages.author', 'messages.attachments'])
            ->withCount(['messages as messages_total' => fn (Builder $m) => $m->where('internal', false)])
            ->find($id) ?? throw ErrorCode::TicketNotFound->problem();

        return self::tronquer($ticket);
    }

    public static function lightForRequester(Request $request, string $id): SupportTicket
    {
        return SupportTicket::query()
            ->where('requester_user_id', $request->user()?->getAuthIdentifier())
            ->find($id) ?? throw ErrorCode::TicketNotFound->problem();
    }

    public static function lightForSupport(string $id): SupportTicket
    {
        return SupportTicket::query()->find($id) ?? throw ErrorCode::TicketNotFound->problem();
    }

    public static function forSupport(string $id): SupportTicket
    {
        $ticket = SupportTicket::query()
            ->with(['requester', 'assignee', 'messages' => self::borne(false), 'messages.author', 'messages.attachments', 'accessGrants.operator'])
            ->withCount(['messages as messages_total'])
            ->find($id) ?? throw ErrorCode::TicketNotFound->problem();

        return self::tronquer($ticket);
    }

    /**
     * Les `FIL_MAX` derniers messages (un de plus pour savoir s'il en reste), le plus récent d'abord.
     *
     * @return Closure(HasMany<SupportTicketMessage, SupportTicket>): void
     */
    private static function borne(bool $visiblesSeulement): Closure
    {
        return function (HasMany $messages) use ($visiblesSeulement): void {
            $messages->when($visiblesSeulement, fn ($q) => $q->where('internal', false))->reorder()->orderByDesc('sent_at')->orderByDesc('id')->limit(self::FIL_MAX + 1);
        };
    }

    private static function tronquer(SupportTicket $ticket): SupportTicket
    {
        $recents = $ticket->messages;
        $ticket->setAttribute('messages_has_more', $recents->count() > self::FIL_MAX);
        $ticket->syncOriginalAttribute('messages_has_more');
        $ticket->setRelation('messages', $recents->take(self::FIL_MAX)->reverse()->values());

        return $ticket;
    }

    public static function download(Request $request, string $id, bool $vueSupport): StreamedResponse
    {
        $piece = SupportAttachment::query()->with('message.ticket')->find($id);
        $message = $piece?->message;
        $autorise = $message !== null && ($vueSupport || (! $message->internal && $message->ticket->requester_user_id === $request->user()?->getAuthIdentifier()));

        if ($piece === null || ! $autorise || ! AttachmentStore::exists($piece->path)) {
            throw ErrorCode::AttachmentNotFound->problem();
        }

        app(PathAttachmentGate::class)->assertReadable($piece, $piece->path);

        return AttachmentStore::response($piece->path, $piece->original_name, $piece->mime_type);
    }
}
