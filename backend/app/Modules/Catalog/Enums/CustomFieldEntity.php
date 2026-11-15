<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Enums;

enum CustomFieldEntity: string
{
    case Unit = 'unit';
    case Property = 'property';
    case Party = 'party';
    case Lease = 'lease';
    case Mandate = 'mandate';
    case Equipment = 'equipment';
    case Intervention = 'intervention';
}
