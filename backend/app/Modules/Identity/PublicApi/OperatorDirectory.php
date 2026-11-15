<?php

declare(strict_types=1);

namespace App\Modules\Identity\PublicApi;

use App\Modules\Identity\Data\OperatorData;
use App\Modules\Identity\Queries\ActiveOperators;

final readonly class OperatorDirectory
{
    public function __construct(private ActiveOperators $operateurs) {}

    /**
     * @return list<OperatorData>
     */
    public function active(): array
    {
        return $this->operateurs->all();
    }

    public function isActive(string $userId): bool
    {
        return $this->operateurs->has($userId);
    }
}
