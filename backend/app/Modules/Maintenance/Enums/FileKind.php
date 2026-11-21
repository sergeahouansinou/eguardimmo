<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum FileKind: string
{
    case PhotoBefore = 'photo_before';
    case PhotoAfter = 'photo_after';
    case Quote = 'quote';
    case Invoice = 'invoice';
    case Report = 'report';
    case Proof = 'proof';
    case Other = 'other';
}
