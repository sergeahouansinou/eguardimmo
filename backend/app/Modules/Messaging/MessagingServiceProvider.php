<?php

declare(strict_types=1);

namespace App\Modules\Messaging;

use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Messaging\Models\ConversationParticipant;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Modules\Messaging\Models\SupportAttachment;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Models\SupportTicketMessage;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

final class MessagingServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Relation::enforceMorphMap([
            'support_ticket' => SupportTicket::class,
            'support_ticket_message' => SupportTicketMessage::class,
            'support_attachment' => SupportAttachment::class,
            'support_access_grant' => SupportAccessGrant::class,
            'conversation' => Conversation::class,
            'conversation_participant' => ConversationParticipant::class,
            'conversation_message' => ConversationMessage::class,
            'conversation_attachment' => ConversationAttachment::class,
        ]);
    }
}
