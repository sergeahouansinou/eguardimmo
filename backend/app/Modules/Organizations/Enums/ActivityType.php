<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Enums;

enum ActivityType: string
{
    case Rights = 'droits';
    case Payment = 'paiement';
    case Document = 'document';
    case Export = 'export';
    case Security = 'securite';
    case Other = 'autre';
}
