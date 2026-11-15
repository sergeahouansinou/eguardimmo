<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Identity\Data\OperatorData;
use App\Modules\Identity\PublicApi\OperatorDirectory;
use Illuminate\Http\JsonResponse;

final class ListStaffController
{
    public function __invoke(OperatorDirectory $operateurs): JsonResponse
    {
        return new JsonResponse(['data' => array_map(
            fn (OperatorData $o): array => ['id' => $o->userId, 'name' => $o->name],
            $operateurs->active(),
        )]);
    }
}
