<?php

declare(strict_types=1);

namespace App\Modules\Investments\Support;

use App\Modules\Investments\Enums\ErrorCode;
use App\Modules\Properties\PublicApi\UnitDirectory;

/**
 * Le bien et le lot désignés par le client doivent exister dans l'organisation courante et s'appartenir.
 */
final readonly class Scopes
{
    public function __construct(private UnitDirectory $lots) {}

    public function assert(string $propertyId, ?string $unitId): void
    {
        $this->lots->findProperty($propertyId);

        if ($unitId !== null && $this->lots->find($unitId)->propertyId !== $propertyId) {
            throw ErrorCode::TargetInvalid->problem('Le lot n\'appartient pas à ce bien.');
        }
    }
}
