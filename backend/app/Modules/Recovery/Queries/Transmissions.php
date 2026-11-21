<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Queries;

use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Recovery\Models\RecoveryTransmission;
use Illuminate\Support\Str;

final readonly class Transmissions
{
    public function get(string $id): RecoveryTransmission
    {
        return (Str::isUuid($id) ? RecoveryTransmission::query()->find($id) : null) ?? throw ErrorCode::TransmissionNotFound->problem();
    }
}
