<?php

declare(strict_types=1);

namespace App\Modules\Charges\Enums;

enum ExerciseStatus: string
{
    case Draft = 'draft';
    case Computed = 'computed';
    case Issuing = 'issuing';
    case Issued = 'issued';
    case Discarded = 'discarded';

    public function isEditable(): bool
    {
        return in_array($this, [self::Draft, self::Computed], true);
    }
}
