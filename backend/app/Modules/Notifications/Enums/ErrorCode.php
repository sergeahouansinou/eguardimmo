<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case NotificationNotFound = 'notification_not_found';
    case PushTokenNotFound = 'push_token_not_found';
    case ChannelMandatory = 'notification_channel_mandatory';
    case MobileSessionRequired = 'push_token_mobile_session_required';
    case CampaignNotFound = 'campaign_not_found';
    case CampaignAttachmentNotFound = 'campaign_attachment_not_found';
    case CampaignNotEditable = 'campaign_not_editable';
    case CampaignVersionConflict = 'campaign_version_conflict';
    case CampaignQuotaReached = 'campaign_quota_reached';
    case CampaignAudienceEmpty = 'campaign_audience_empty';
    case CampaignAudienceUnavailable = 'campaign_audience_unavailable';
    case CampaignScheduleInvalid = 'campaign_schedule_invalid';
    case CampaignSendingDisabled = 'campaign_sending_disabled';
    case CampaignAttachmentLimit = 'campaign_attachment_limit';
    case UnsubscribeTokenInvalid = 'unsubscribe_token_invalid';
    case MailWebhookUnauthorized = 'mail_webhook_unauthorized';
    case AnnouncementNotFound = 'announcement_not_found';
    case MailWebhookPayloadInvalid = 'mail_webhook_payload_invalid';
    case CampaignAttachmentNotReady = 'campaign_attachment_not_ready';
    case CampaignSenderNotAllowed = 'campaign_sender_not_allowed';

    public function problem(): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail());
    }

    /**
     * @param  array<string, string>  $headers
     */
    public function problemWith(array $headers): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail(), $headers);
    }

    public function status(): int
    {
        return match ($this) {
            self::NotificationNotFound, self::PushTokenNotFound, self::CampaignNotFound, self::CampaignAttachmentNotFound,
            self::UnsubscribeTokenInvalid, self::AnnouncementNotFound => 404,
            self::ChannelMandatory, self::CampaignAudienceEmpty, self::CampaignAudienceUnavailable, self::CampaignScheduleInvalid, self::MailWebhookPayloadInvalid => 422,
            self::MobileSessionRequired, self::CampaignSenderNotAllowed => 403,
            self::CampaignNotEditable, self::CampaignVersionConflict, self::CampaignAttachmentLimit, self::CampaignAttachmentNotReady => 409,
            self::CampaignQuotaReached => 429,
            self::CampaignSendingDisabled => 503,
            self::MailWebhookUnauthorized => 401,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::NotificationNotFound => 'Notification introuvable',
            self::PushTokenNotFound => 'Appareil introuvable',
            self::ChannelMandatory => 'Canal obligatoire',
            self::MobileSessionRequired => 'Session mobile requise',
            self::CampaignNotFound => 'Diffusion introuvable',
            self::CampaignAttachmentNotFound => 'Pièce de diffusion introuvable',
            self::CampaignNotEditable => 'Diffusion non modifiable',
            self::CampaignVersionConflict => 'Diffusion modifiée entre-temps',
            self::CampaignQuotaReached => 'Plafond de diffusions atteint',
            self::CampaignAudienceEmpty => 'Aucun destinataire',
            self::CampaignAudienceUnavailable => 'Destinataires indisponibles',
            self::CampaignScheduleInvalid => 'Date d\'envoi invalide',
            self::CampaignSendingDisabled => 'Envoi des diffusions désactivé',
            self::CampaignAttachmentLimit => 'Trop de pièces jointes',
            self::UnsubscribeTokenInvalid => 'Lien de désinscription invalide',
            self::MailWebhookUnauthorized => 'Signature refusée',
            self::AnnouncementNotFound => 'Annonce introuvable',
            self::MailWebhookPayloadInvalid => 'Requête illisible',
            self::CampaignAttachmentNotReady => 'Pièce en cours de vérification',
            self::CampaignSenderNotAllowed => 'Expéditeur non autorisé',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::NotificationNotFound => 'Cette notification n\'existe pas ou ne vous concerne pas.',
            self::PushTokenNotFound => 'Cet appareil n\'est pas enregistré pour les notifications.',
            self::ChannelMandatory => 'Ce canal ne peut pas être désactivé pour ce type de notification.',
            self::MobileSessionRequired => 'Les notifications mobiles ne s\'enregistrent que depuis l\'application mobile connectée.',
            self::CampaignNotFound => 'Cette diffusion n\'existe pas.',
            self::CampaignAttachmentNotFound => 'Cette pièce n\'existe pas.',
            self::CampaignNotEditable => 'Seul un brouillon se modifie ; une diffusion programmée s\'annule, une diffusion envoyée ne change plus.',
            self::CampaignVersionConflict => 'La diffusion a changé depuis votre dernière lecture : rechargez-la.',
            self::CampaignQuotaReached => 'Le plafond de destinataires sur 24 heures ou d\'envois par heure est atteint : réessayez plus tard.',
            self::CampaignAudienceEmpty => 'Aucun destinataire ne reçoit cette diffusion : choisissez d\'autres destinataires.',
            self::CampaignAudienceUnavailable => 'Ces destinataires ne sont pas disponibles pour cette organisation.',
            self::CampaignScheduleInvalid => 'La date d\'envoi doit être dans au moins 15 minutes.',
            self::CampaignSendingDisabled => 'L\'envoi d\'e-mails n\'est pas encore activé sur la plateforme : la diffusion reste enregistrée.',
            self::CampaignAttachmentLimit => 'Une diffusion porte trois pièces au plus.',
            self::UnsubscribeTokenInvalid => 'Ce lien de désinscription est invalide ou expiré.',
            self::MailWebhookUnauthorized => 'La signature de la requête est absente ou incorrecte.',
            self::AnnouncementNotFound => 'Cette annonce n\'existe pas ou ne vous concerne pas.',
            self::MailWebhookPayloadInvalid => 'Le corps de la requête n\'est pas une liste d\'événements.',
            self::CampaignSenderNotAllowed => 'L\'auteur de l\'envoi n\'est plus membre actif avec un rôle autorisé et la double authentification : la diffusion reste en l\'état.',
            self::CampaignAttachmentNotReady => 'Une pièce n\'a pas encore passé la vérification antivirus, ou n\'a pas pu être vérifiée : l\'envoi reste bloqué.',
        };
    }
}
