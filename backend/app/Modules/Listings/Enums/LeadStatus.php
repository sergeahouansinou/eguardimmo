<?php

declare(strict_types=1);

namespace App\Modules\Listings\Enums;

enum LeadStatus: string
{
    case New = 'new';
    case Answered = 'answered';
}
