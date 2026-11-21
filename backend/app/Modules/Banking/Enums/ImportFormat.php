<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum ImportFormat: string
{
    case Csv = 'csv';
    case Camt053 = 'camt053';

    public function isXml(): bool
    {
        return $this === self::Camt053;
    }
}
