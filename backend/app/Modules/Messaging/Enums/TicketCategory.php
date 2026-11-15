<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Enums;

enum TicketCategory: string
{
    case Messaging = 'messaging';
    case Billing = 'billing';
    case Account = 'account';
    case Documents = 'documents';
    case Other = 'other';
}
