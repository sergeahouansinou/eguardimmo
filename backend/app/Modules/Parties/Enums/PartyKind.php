<?php

declare(strict_types=1);

namespace App\Modules\Parties\Enums;

enum PartyKind: string
{
    case Person = 'person';
    case Company = 'company';
}
