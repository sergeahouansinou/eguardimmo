<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

enum PlatformCampaignStatus: string
{
    case Draft = 'draft';
    case Sending = 'sending';
    case Sent = 'sent';
}
