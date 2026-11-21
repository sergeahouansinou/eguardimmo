<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Enums;

enum TaxCode: string
{
    case Vat = 'vat';
    case Gst = 'gst';
    case Qst = 'qst';
}
