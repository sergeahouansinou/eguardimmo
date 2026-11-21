<?php

declare(strict_types=1);

namespace App\Modules\Charges\Enums;

enum KeyKind: string
{
    case Tantiemes = 'tantiemes';
    case Surface = 'surface';
    case Equal = 'equal';
    case Consumption = 'consumption';
    case Custom = 'custom';
}
