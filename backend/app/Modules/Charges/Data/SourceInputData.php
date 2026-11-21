<?php

declare(strict_types=1);

namespace App\Modules\Charges\Data;

use App\Modules\Charges\Enums\SourceKind;

final readonly class SourceInputData
{
    /**
     * @param  ?int  $amount  unités mineures retenues ; absent : le serveur propose la part au prorata des jours de service compris dans l'exercice
     */
    public function __construct(
        public SourceKind $kind,
        public string $id,
        public ?int $amount,
    ) {}
}
