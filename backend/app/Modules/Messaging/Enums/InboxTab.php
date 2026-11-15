<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Enums;

enum InboxTab: string
{
    case All = 'all';
    case Unread = 'unread';
    case Awaiting = 'awaiting';
    case Sent = 'sent';
    case Archived = 'archived';
}
