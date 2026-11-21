<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Enums\ErrorCode;

/**
 * L'envoi réel des diffusions n'existe que si le fournisseur est configuré (ADR 0033, décision 13) : sans lui, une diffusion se
 * crée, se valide et se programme sans rien envoyer.
 */
final class MailProvider
{
    public const string MAILTRAP = 'mailtrap';

    public function enabled(): bool
    {
        return config('notifications.campaigns.provider') === self::MAILTRAP
            && filter_var($this->fromAddress(), FILTER_VALIDATE_EMAIL) !== false
            && is_string(config('notifications.campaigns.unsubscribe_key')) && config('notifications.campaigns.unsubscribe_key') !== ''
            && is_string(config('audit.hmac_key')) && config('audit.hmac_key') !== '';
    }

    public function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw ErrorCode::CampaignSendingDisabled->problem();
        }
    }

    public function fromAddress(): string
    {
        return (string) config('notifications.campaigns.from_address');
    }

    public function mailer(): string
    {
        return (string) config('notifications.campaigns.bulk_mailer');
    }
}
