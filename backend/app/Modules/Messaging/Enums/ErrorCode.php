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
    case ConversationClosed = 'conversation_closed';
    case ConversationMuted = 'conversation_muted';
    case ConversationOpenLimit = 'conversation_open_limit';
    case ConversationStorageFull = 'conversation_storage_full';
    case ConversationAttachmentLimit = 'conversation_attachment_limit';
    case ConversationReadOnly = 'conversation_read_only';
    case ConversationKindUnavailable = 'conversation_kind_unavailable';
    case ConversationLinkNotFound = 'conversation_link_not_found';
    case MessageNotFound = 'message_not_found';
    case MessageRedactionExpired = 'message_redaction_expired';
    case MessageRedactionForbidden = 'message_redaction_forbidden';
    case IdempotencyKeyReused = 'idempotency_key_reused';
    case AssigneeInvalid = 'assignee_invalid';
    case ConversationBusy = 'conversation_busy';
    case SupportSpaceForbidden = 'support_space_forbidden';
    case SupportAccessRequired = 'support_access_required';
    case SupportAccessNotFound = 'support_access_not_found';
    case SupportAccessDurationInvalid = 'support_access_duration_invalid';
    case SupportAccessScopeInvalid = 'support_access_scope_invalid';
    case SupportAccessOrganizationRequired = 'support_access_organization_required';
    case SupportAccessNotPending = 'support_access_not_pending';
    case SupportAccessAlreadyOpen = 'support_access_already_open';
    case SupportAccessReviewForbidden = 'support_access_review_forbidden';
    case SupportAccessNotEmergency = 'support_access_not_emergency';
    case SupportHoursUnavailable = 'support_hours_unavailable';
    case SupportEmergencyReviewPending = 'support_emergency_review_pending';
    case SupportEmergencyOrganizationBusy = 'support_emergency_organization_busy';
    case SupportEmergencyCooldown = 'support_emergency_cooldown';
    case SupportEmergencyLimit = 'support_emergency_limit';

    /**
     * @param  array<string, string>  $headers
     */
    public function problem(array $headers = []): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail(), $headers);
    }

    public function status(): int
    {
        return match ($this) {
            self::TicketNotFound, self::SupportAccessNotFound, self::ConversationNotFound, self::AttachmentNotFound, self::ConversationLinkNotFound, self::MessageNotFound => 404,
            self::TicketResolved, self::ConversationClosed, self::ConversationOpenLimit, self::ConversationStorageFull, self::MessageRedactionExpired, self::IdempotencyKeyReused, self::ConversationBusy, self::SupportAccessNotPending, self::SupportAccessAlreadyOpen, self::SupportAccessNotEmergency, self::SupportEmergencyReviewPending, self::SupportEmergencyOrganizationBusy => 409,
            self::NotAnOperator, self::NotAMember, self::RecipientNotFound, self::AssigneeInvalid, self::SupportAccessDurationInvalid, self::SupportAccessScopeInvalid, self::SupportAccessOrganizationRequired => 422,
            self::ConversationMuted, self::ConversationReadOnly, self::ConversationKindUnavailable, self::MessageRedactionForbidden, self::SupportSpaceForbidden, self::SupportAccessRequired, self::SupportAccessReviewForbidden => 403,
            self::ConversationAttachmentLimit, self::SupportEmergencyCooldown, self::SupportEmergencyLimit => 429,
            self::SupportHoursUnavailable => 503,
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
            self::ConversationClosed => 'Conversation fermée',
            self::ConversationMuted => 'Conversation restreinte',
            self::ConversationOpenLimit => 'Trop de conversations ouvertes',
            self::ConversationStorageFull => 'Espace de pièces jointes plein',
            self::ConversationAttachmentLimit => 'Trop de pièces jointes aujourd\'hui',
            self::ConversationReadOnly => 'Conversation en lecture seule',
            self::ConversationKindUnavailable => 'Conversation non disponible',
            self::ConversationLinkNotFound => 'Rattachement introuvable',
            self::MessageNotFound => 'Message introuvable',
            self::MessageRedactionExpired => 'Retrait impossible',
            self::MessageRedactionForbidden => 'Retrait non permis',
            self::IdempotencyKeyReused => 'Clé d\'idempotence déjà utilisée',
            self::AssigneeInvalid => 'Assignation impossible',
            self::ConversationBusy => 'Opération en cours',
            self::SupportSpaceForbidden => 'Espace non autorisé',
            self::SupportAccessRequired => 'Accès du support requis',
            self::SupportAccessNotFound => 'Accès du support introuvable',
            self::SupportAccessDurationInvalid => 'Durée d\'accès invalide',
            self::SupportAccessScopeInvalid => 'Périmètre d\'accès invalide',
            self::SupportAccessOrganizationRequired => 'Organisation requise',
            self::SupportAccessNotPending => 'Accès du support déjà traité',
            self::SupportAccessAlreadyOpen => 'Accès du support déjà ouvert',
            self::SupportAccessReviewForbidden => 'Revue non permise',
            self::SupportAccessNotEmergency => 'Accès sans revue',
            self::SupportHoursUnavailable => 'Horaires du support indisponibles',
            self::SupportEmergencyReviewPending => 'Revue d\'urgence en attente',
            self::SupportEmergencyOrganizationBusy => 'Urgence déjà ouverte',
            self::SupportEmergencyCooldown => 'Urgence suspendue',
            self::SupportEmergencyLimit => 'Trop d\'urgences',
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
            self::ConversationClosed => 'Cette conversation est fermée : ouvrez-en une nouvelle ou attendez la réponse de l\'agence.',
            self::ConversationMuted => 'L\'agence a restreint l\'envoi de messages sur cette conversation : vous pouvez encore la lire.',
            self::ConversationOpenLimit => 'Le nombre de conversations ouvertes est atteint : attendez qu\'une d\'elles soit fermée.',
            self::ConversationStorageFull => 'Cette conversation ne peut plus recevoir de pièces jointes.',
            self::ConversationAttachmentLimit => 'Le nombre de pièces jointes envoyées aujourd\'hui est atteint : réessayez demain.',
            self::ConversationReadOnly => 'Votre mandat est terminé : vous ne pouvez plus répondre dans cette conversation.',
            self::ConversationKindUnavailable => 'Ce type de conversation n\'est pas disponible pour cette organisation ou ce rôle.',
            self::ConversationLinkNotFound => 'Ce bail ou ce mandat n\'existe pas dans votre espace.',
            self::MessageNotFound => 'Ce message n\'existe pas dans cette conversation.',
            self::MessageRedactionExpired => 'Un message ne se retire que dans les 15 minutes qui suivent son envoi.',
            self::MessageRedactionForbidden => 'Vous ne pouvez pas retirer ce message.',
            self::IdempotencyKeyReused => 'Cette clé a déjà servi pour un autre message.',
            self::AssigneeInvalid => 'Une conversation ne s\'assigne qu\'à un membre actif de l\'équipe de gestion.',
            self::ConversationBusy => 'Une autre opération est en cours sur cette fiche ou ce compte : réessayez dans un instant.',
            self::SupportSpaceForbidden => 'Vous n\'avez pas le profil de l\'espace depuis lequel vous ouvrez cette demande.',
            self::SupportAccessRequired => 'Aucun accès valide ne couvre cette ressource : demandez le consentement de l\'organisation.',
            self::SupportAccessNotFound => 'Cet accès n\'existe pas ou ne concerne pas votre organisation.',
            self::SupportAccessDurationInvalid => 'La durée d\'un accès va de 1 à 72 heures.',
            self::SupportAccessScopeInvalid => 'Le périmètre accordé ne peut pas dépasser celui qui a été demandé.',
            self::SupportAccessOrganizationRequired => 'Cette demande n\'est rattachée à aucune organisation : le support n\'a aucun accès à demander.',
            self::SupportAccessNotPending => 'Cet accès a déjà été accepté, refusé, révoqué ou a expiré.',
            self::SupportAccessAlreadyOpen => 'Un accès est déjà demandé ou ouvert pour cette demande.',
            self::SupportAccessReviewForbidden => 'La revue d\'un accès d\'urgence revient à un autre opérateur que celui qui l\'a ouvert.',
            self::SupportAccessNotEmergency => 'Seul un accès d\'urgence fait l\'objet d\'une revue.',
            self::SupportHoursUnavailable => 'Les horaires du support sont mal configurés : réessayez plus tard.',
            self::SupportEmergencyReviewPending => 'Votre précédent accès d\'urgence à cette organisation n\'a pas été revu par un autre opérateur.',
            self::SupportEmergencyOrganizationBusy => 'Un accès d\'urgence est déjà ouvert sur cette organisation.',
            self::SupportEmergencyCooldown => 'L\'organisation a révoqué un accès d\'urgence : aucun nouvel accès sans consentement ne s\'ouvre avant la fin du délai.',
            self::SupportEmergencyLimit => 'Le nombre d\'accès d\'urgence ouverts sur cette organisation ces dernières 24 heures est atteint.',
        };
    }
}
