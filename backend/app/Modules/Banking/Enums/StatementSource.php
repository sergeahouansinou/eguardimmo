<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum StatementSource: string
{
    case Camt053 = 'camt053';
    case Mt940 = 'mt940';
    case Cfonb120 = 'cfonb120';
    case Csv = 'csv';
    case Aggregator = 'aggregator';
}
