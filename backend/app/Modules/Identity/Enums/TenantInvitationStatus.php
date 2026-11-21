<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

enum TenantInvitationStatus: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Revoked = 'revoked';
}
