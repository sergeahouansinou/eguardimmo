<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Enums;

enum RemarkKind: string
{
    case Complement = 'complement';
    case Heating = 'heating';
    case Comment = 'comment';

    public function inspectionKind(): InspectionKind
    {
        return $this === self::Comment ? InspectionKind::Exit : InspectionKind::Entry;
    }
}
