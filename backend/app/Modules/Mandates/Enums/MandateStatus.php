<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Enums;

enum MandateStatus: string
{
    case Draft = 'draft';
    case Active = 'active';
    case Suspended = 'suspended';
    case Terminated = 'terminated';
    case Expired = 'expired';
}
