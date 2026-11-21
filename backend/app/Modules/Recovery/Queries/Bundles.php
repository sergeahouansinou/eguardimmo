<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Queries;

use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Recovery\Models\RecoveryBundle;
use Illuminate\Support\Str;

final readonly class Bundles
{
    public function get(string $id): RecoveryBundle
    {
        return (Str::isUuid($id) ? RecoveryBundle::query()->with('transmissions.downloads')->find($id) : null) ?? throw ErrorCode::BundleNotFound->problem();
    }
}
