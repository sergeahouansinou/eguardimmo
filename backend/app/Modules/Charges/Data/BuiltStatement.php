<?php

declare(strict_types=1);

namespace App\Modules\Charges\Data;

final readonly class BuiltStatement
{
    /**
     * @param  array<string, mixed>  $row  colonnes de `charge_statements`, sans identifiant ni organisation
     * @param  list<array<string, mixed>>  $lines  colonnes de `charge_statement_lines`, sans identifiant ni organisation ni décompte
     */
    public function __construct(
        public string $leaseId,
        public array $row,
        public array $lines,
    ) {}
}
