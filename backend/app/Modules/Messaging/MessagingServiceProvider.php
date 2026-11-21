<?php

declare(strict_types=1);

namespace App\Modules\Messaging;

use App\Modules\Messaging\Console\EraseAnonymizedPartiesCommand;
use App\Modules\Messaging\Console\ExpireSupportAccessCommand;
use App\Modules\Messaging\Console\PurgeCommand;
use App\Modules\Messaging\Console\ResolveStaleTicketsCommand;
use App\Modules\Messaging\Enums\SupportAccessScope;
use App\Modules\Messaging\Http\Middleware\EnsureSupportAccess;
use App\Modules\Messaging\Http\Middleware\PrivateResponse;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Messaging\Models\ConversationParticipant;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Modules\Messaging\Models\SupportAttachment;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Models\SupportTicketMessage;
use App\Modules\Messaging\Support\OperationLocks;
use App\Modules\Messaging\Support\SupportAccessGate;
use App\Shared\Audit\ActivityDisclosure;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;

final class MessagingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(OperationLocks::class);
        $this->app->singleton(ActivityDisclosure::class);
    }

    public function boot(Router $routeur, ActivityDisclosure $divulgation): void
    {
        $divulgation->useRule(fn (string $operateurId, string $organisationId): bool => $this->app->make(SupportAccessGate::class)->live($operateurId, $organisationId, SupportAccessScope::Settings) !== null);

        $routeur->aliasMiddleware('messaging.private', PrivateResponse::class);
        $routeur->aliasMiddleware('support-access', EnsureSupportAccess::class);

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

        if ($this->app->runningInConsole()) {
            $this->commands([EraseAnonymizedPartiesCommand::class, ResolveStaleTicketsCommand::class, ExpireSupportAccessCommand::class, PurgeCommand::class]);
        }
    }
}
