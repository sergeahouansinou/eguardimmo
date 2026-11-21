<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Enums;

enum MandateDocumentKind: string
{
    case Mandate = 'mandate';
    case Amendment = 'amendment';
    case Diagnostic = 'diagnostic';
    case Insurance = 'insurance';
    case Other = 'other';
}
