<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Enums;

enum DocumentUploader: string
{
    case Agency = 'agency';
    case Owner = 'owner';
}
