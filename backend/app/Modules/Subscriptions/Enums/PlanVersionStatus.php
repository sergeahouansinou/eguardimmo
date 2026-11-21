<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Enums;

enum PlanVersionStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Archived = 'archived';
}
