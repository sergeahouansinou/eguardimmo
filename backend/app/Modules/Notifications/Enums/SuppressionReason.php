<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

enum SuppressionReason: string
{
    case Unsubscribed = 'unsubscribed';
    case Bounce = 'bounce';
    case Complaint = 'complaint';
}
