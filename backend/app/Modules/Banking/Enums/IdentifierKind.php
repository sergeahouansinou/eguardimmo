<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum IdentifierKind: string
{
    case Iban = 'iban';
    case Other = 'other';
}
