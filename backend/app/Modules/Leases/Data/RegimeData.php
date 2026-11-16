<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

use App\Modules\Leases\Jurisdictions\LeaseRegime;
use App\Modules\Leases\Jurisdictions\RegimeField;

final readonly class RegimeData
{
    /**
     * @param  list<array{key: string, type: string, options: list<string>}>  $fields
     */
    public function __construct(
        public string $key,
        public string $jurisdiction,
        public string $label,
        public string $currency,
        public RegimeTermsData $defaults,
        public array $fields,
    ) {}

    public static function from(LeaseRegime $regime): self
    {
        return new self(
            $regime->key(),
            $regime->jurisdiction(),
            $regime->label(),
            $regime->currency(),
            RegimeTermsData::from($regime, []),
            array_map(
                static fn (RegimeField $champ): array => ['key' => $champ->key, 'type' => $champ->type, 'options' => $champ->options],
                $regime->jurisdictionDataFields(),
            ),
        );
    }
}
