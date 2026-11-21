<?php

declare(strict_types=1);

namespace App\Modules\Payments\Enums;

enum OnlinePaymentStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Succeeded = 'succeeded';
    case Failed = 'failed';
    case Cancelled = 'cancelled';
    case Expired = 'expired';

    public function isLive(): bool
    {
        return $this === self::Pending || $this === self::Processing;
    }

    /**
     * Transitions monotones. Exception voulue : un succès confirmé par le PSP l'emporte sur une annulation ou une expiration
     * locale, car l'argent a bougé.
     */
    public function canBecome(self $cible): bool
    {
        return match ($this) {
            self::Pending => $cible !== self::Pending,
            self::Processing => $cible !== self::Pending && $cible !== self::Processing,
            self::Cancelled, self::Expired => $cible === self::Succeeded,
            self::Succeeded, self::Failed => false,
        };
    }
}
