<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

enum DeliveryStatus: string
{
    case Queued = 'queued';
    case Sending = 'sending';
    case Sent = 'sent';
    case Unknown = 'unknown';
    case Bounced = 'bounced';
    case Failed = 'failed';
    case Suppressed = 'suppressed';
    case SkippedNoEmail = 'skipped_no_email';

    public function isFinal(): bool
    {
        return ! in_array($this, [self::Queued, self::Sending], true);
    }

    public function isFailure(): bool
    {
        return in_array($this, [self::Unknown, self::Bounced, self::Failed], true);
    }
}
