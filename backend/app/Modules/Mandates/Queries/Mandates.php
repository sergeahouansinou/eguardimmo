<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Models\Mandate;
use Illuminate\Support\Str;

final readonly class Mandates
{
    public function get(string $id): Mandate
    {
        return (Str::isUuid($id) ? Mandate::query()->find($id) : null) ?? throw ErrorCode::MandateNotFound->problem();
    }

    public function locked(string $id): Mandate
    {
        return (Str::isUuid($id) ? Mandate::query()->whereKey($id)->lockForUpdate()->first() : null) ?? throw ErrorCode::MandateNotFound->problem();
    }
}
