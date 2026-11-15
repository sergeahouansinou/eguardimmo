<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case TicketNotFound = 'ticket_not_found';
    case TicketResolved = 'ticket_resolved';
    case NotAnOperator = 'assignee_not_operator';
    case NotAMember = 'organization_not_member';
    case ConversationNotFound = 'conversation_not_found';
    case RecipientNotFound = 'recipient_not_found';
    case AttachmentNotFound = 'attachment_not_found';

    public function problem(): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::TicketNotFound, self::ConversationNotFound, self::AttachmentNotFound => 404,
            self::TicketResolved => 409,
            self::NotAnOperator, self::NotAMember, self::RecipientNotFound => 422,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::TicketNotFound => 'Demande introuvable',
            self::TicketResolved => 'Demande résolue',
            self::NotAnOperator => 'Assignation impossible',
            self::NotAMember => 'Organisation inconnue',
            self::ConversationNotFound => 'Conversation introuvable',
            self::RecipientNotFound => 'Destinataire inconnu',
            self::AttachmentNotFound => 'Pièce jointe introuvable',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::TicketNotFound => 'Cette demande d\'assistance n\'existe pas ou ne vous concerne pas.',
            self::TicketResolved => 'Cette demande est résolue : ouvrez-en une nouvelle.',
            self::NotAnOperator => 'Une demande ne s\'assigne qu\'à un opérateur actif.',
            self::NotAMember => 'Vous n\'êtes pas membre de cette organisation.',
            self::ConversationNotFound => 'Cette conversation n\'existe pas ou ne vous concerne pas.',
            self::RecipientNotFound => 'Ce destinataire ne fait pas partie de vos contacts.',
            self::AttachmentNotFound => 'Cette pièce jointe n\'existe pas ou ne vous est pas accessible.',
        };
    }
}
