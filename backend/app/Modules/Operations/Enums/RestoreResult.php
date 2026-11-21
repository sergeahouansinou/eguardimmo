<?php

declare(strict_types=1);

namespace App\Modules\Operations\Enums;

enum RestoreResult: string
{
    case Passed = 'passed';
    case Failed = 'failed';
}
