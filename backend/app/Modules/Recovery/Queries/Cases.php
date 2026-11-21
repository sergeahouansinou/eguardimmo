<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Queries;

use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Recovery\Models\RecoveryCase;
use Illuminate\Support\Str;

final readonly class Cases
{
    public function get(string $id): RecoveryCase
    {
        return (Str::isUuid($id) ? RecoveryCase::query()->with(['items', 'bundles.transmissions'])->find($id) : null) ?? throw ErrorCode::CaseNotFound->problem();
    }

    public function find(string $id): RecoveryCase
    {
        return (Str::isUuid($id) ? RecoveryCase::query()->find($id) : null) ?? throw ErrorCode::CaseNotFound->problem();
    }
}
