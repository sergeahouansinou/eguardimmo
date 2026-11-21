<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Enums;

enum RefusalReason: string
{
    case ManifestlyUnfounded = 'manifestly_unfounded';
    case Excessive = 'excessive';
    case IdentityUnverified = 'identity_unverified';
    case LegalObligation = 'legal_obligation';
}
