<?php

declare(strict_types=1);

namespace App\Modules\Tax\Data;

final readonly class FormLineData
{
    public const string COMPUTED = 'computed';

    public const string TO_COMPLETE = 'to_complete';

    public const string TOTAL = 'total';

    /**
     * @param  string  $kind  `computed`, `to_complete` (jamais calculée : saisie par le contribuable) ou `total` (recalculée depuis les lignes arrondies)
     */
    public function __construct(
        public string $code,
        public string $label,
        public string $kind,
    ) {}
}
