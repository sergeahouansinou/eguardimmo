<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Enums;

enum CustomFieldType: string
{
    case Text = 'text';
    case Number = 'number';
    case Money = 'money';
    case Date = 'date';
    case Bool = 'bool';
    case Select = 'select';
    case Multiselect = 'multiselect';
    case Term = 'term';
    case Url = 'url';
}
