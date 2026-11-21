<?php

declare(strict_types=1);

namespace App\Modules\Tax\Data;

final readonly class PropertyResultData
{
    /**
     * @param  list<LineResultData>  $lines  dans l'ordre du formulaire
     * @param  list<array{share_bp: int, nature: string}>  $coOwners
     */
    public function __construct(
        public string $propertyId,
        public string $name,
        public int $premises,
        public array $lines,
        public array $coOwners = [],
    ) {}

    public function line(string $code): LineResultData
    {
        foreach ($this->lines as $ligne) {
            if ($ligne->code === $code) {
                return $ligne;
            }
        }

        throw new \LogicException("Ligne {$code} absente du bien.");
    }
}
