<?php

declare(strict_types=1);

namespace App\Modules\Investments\Enums;

enum FeeKind: string
{
    case Dossier = 'dossier';
    case Guarantee = 'guarantee';
    case Mortgage = 'mortgage';
    case PrepaymentPenalty = 'prepayment_penalty';
    case Other = 'other';
}
