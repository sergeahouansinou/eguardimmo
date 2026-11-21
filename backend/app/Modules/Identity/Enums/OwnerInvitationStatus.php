<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

enum OwnerInvitationStatus: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Revoked = 'revoked';
    case Blocked = 'blocked';
    case Expired = 'expired';
}
