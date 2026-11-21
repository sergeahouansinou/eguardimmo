<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum QuoteStatus: string
{
    case Received = 'received';
    case Submitted = 'submitted';
    case Accepted = 'accepted';
    case Refused = 'refused';
    case Expired = 'expired';
    case Superseded = 'superseded';
}
