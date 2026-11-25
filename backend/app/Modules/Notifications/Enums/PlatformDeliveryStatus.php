<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

enum PlatformDeliveryStatus: string
{
    case Queued = 'queued';
    case Sending = 'sending';
    case Sent = 'sent';
    case Failed = 'failed';
    case Bounced = 'bounced';
    case Suppressed = 'suppressed';
    case Unknown = 'unknown';
    case SkippedNoDevice = 'skipped_no_device';
    case SkippedNoEmail = 'skipped_no_email';

    public function isFailure(): bool
    {
        return in_array($this, [self::Failed, self::Bounced, self::Unknown], true);
    }

    public function isSkipped(): bool
    {
        return in_array($this, [self::Suppressed, self::SkippedNoDevice, self::SkippedNoEmail], true);
    }
}
