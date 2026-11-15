<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Data;

use App\Modules\Organizations\Enums\ScopeType;

final readonly class MemberScopeData
{
    /**
     * @param  list<string>  $propertyIds
     */
    public function __construct(
        public ScopeType $type,
        public array $propertyIds = [],
    ) {}
}
