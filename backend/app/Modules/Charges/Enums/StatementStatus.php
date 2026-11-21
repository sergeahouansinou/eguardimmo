<?php

declare(strict_types=1);

namespace App\Modules\Charges\Enums;

enum StatementStatus: string
{
    case Computed = 'computed';
    case Issued = 'issued';
    case Failed = 'failed';
    case Superseded = 'superseded';
}
