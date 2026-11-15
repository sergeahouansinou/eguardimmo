<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Enums;

enum ContactCategorySemantic: string
{
    case Bailiff = 'bailiff';
    case Craftsman = 'craftsman';
    case Syndic = 'syndic';
    case Insurer = 'insurer';
    case Notary = 'notary';
    case Accountant = 'accountant';
    case Other = 'other';
}
