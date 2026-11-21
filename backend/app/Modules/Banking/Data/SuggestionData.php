<?php

declare(strict_types=1);

namespace App\Modules\Banking\Data;

use App\Modules\Banking\Enums\Confidence;
use App\Modules\Banking\Enums\SuggestionAction;
use App\Modules\Banking\Enums\SuggestionRule;

/**
 * Proposition déterministe pour une ligne : règle, niveau, cibles et explication codée (codes et identifiants, jamais de texte libre).
 */
final readonly class SuggestionData
{
    /**
     * @param  list<array{type: string, id: string, amount: int}>  $targets
     * @param  list<string>  $codes
     * @param  array<string, mixed>  $ids
     */
    public function __construct(
        public SuggestionRule $rule,
        public Confidence $confidence,
        public int $score,
        public SuggestionAction $action,
        public array $targets,
        public array $codes,
        public array $ids = [],
    ) {}
}
