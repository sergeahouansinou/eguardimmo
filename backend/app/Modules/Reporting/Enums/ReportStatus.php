<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Enums;

enum ReportStatus: string
{
    case Draft = 'draft';
    case Generated = 'generated';
    case Published = 'published';
    case Superseded = 'superseded';
    case Discarded = 'discarded';

    public function isEditable(): bool
    {
        return $this === self::Draft || $this === self::Generated;
    }
}
