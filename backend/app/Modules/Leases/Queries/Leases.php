<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Models\Lease;
use Illuminate\Support\Str;

final readonly class Leases
{
    public function get(string $id): Lease
    {
        return (Str::isUuid($id) ? Lease::query()->find($id) : null) ?? throw ErrorCode::LeaseNotFound->problem();
    }

    public function locked(string $id): Lease
    {
        return (Str::isUuid($id) ? Lease::query()->whereKey($id)->lockForUpdate()->first() : null) ?? throw ErrorCode::LeaseNotFound->problem();
    }
}
