<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum LeaseDocumentKind: string
{
    case Amendment = 'amendment';
    case Diagnostic = 'diagnostic';
    case Letter = 'letter';
    case Attestation = 'attestation';
    case Other = 'other';
}
