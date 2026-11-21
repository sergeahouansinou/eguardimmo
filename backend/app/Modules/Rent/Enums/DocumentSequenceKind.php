<?php

declare(strict_types=1);

namespace App\Modules\Rent\Enums;

enum DocumentSequenceKind: string
{
    case Notice = 'notice';
    case Receipt = 'receipt';

    public function prefix(): string
    {
        return match ($this) {
            self::Notice => 'AV',
            self::Receipt => 'QT',
        };
    }
}
