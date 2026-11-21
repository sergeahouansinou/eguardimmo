<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum ReconciliationStatus: string
{
    case Draft = 'draft';
    case Validated = 'validated';
    case Superseded = 'superseded';
}
