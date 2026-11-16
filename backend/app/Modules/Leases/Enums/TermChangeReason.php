<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum TermChangeReason: string
{
    case Initial = 'initial';
    case Revision = 'revision';
    case Amendment = 'amendment';
    case Renewal = 'renewal';
    case Correction = 'correction';
}
