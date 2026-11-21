<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Enums;

enum SequenceKind: string
{
    case CaseFile = 'case';
    case Bundle = 'bundle';
    case Lock = 'lock';

    public function prefix(): string
    {
        return match ($this) {
            self::CaseFile => 'RC',
            self::Bundle => 'EP',
            self::Lock => '',
        };
    }
}
