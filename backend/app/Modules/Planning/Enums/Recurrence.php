<?php

declare(strict_types=1);

namespace App\Modules\Planning\Enums;

enum Recurrence: string
{
    case None = 'none';
    case Weekly = 'weekly';
    case Monthly = 'monthly';
    case Yearly = 'yearly';
}
