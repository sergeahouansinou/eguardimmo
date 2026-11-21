<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Enums;

enum SubscriptionStatus: string
{
    case Trialing = 'trialing';
    case Free = 'free';
    case Active = 'active';
    case PastDue = 'past_due';
    case Cancelling = 'cancelling';
    case Ended = 'ended';
}
