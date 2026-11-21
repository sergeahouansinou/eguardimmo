<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Resources;

use App\Modules\Banking\Enums\Confidence;
use App\Modules\Banking\Models\BankSuggestion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `explanation` ne porte que des codes et des identifiants : le texte est rendu par le front. `preselected` jamais vrai pour `weak`.
 *
 * @property BankSuggestion $resource
 */
final class BankSuggestionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $r = $this->resource;

        return [
            'id' => $r->id,
            'statement_line_id' => $r->statement_line_id,
            'rule' => $r->rule->value,
            'confidence' => $r->confidence->value,
            'preselected' => $r->confidence !== Confidence::Weak,
            'score' => $r->score,
            'action' => $r->action->value,
            'targets' => $r->targets,
            'explanation' => $r->explanation,
            'computed_at' => $r->computed_at->toIso8601String(),
        ];
    }
}
