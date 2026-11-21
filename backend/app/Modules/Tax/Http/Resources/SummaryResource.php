<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Resources;

use App\Modules\Tax\Http\Support\IncomeView;
use App\Modules\Tax\Models\TaxSummary;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Synthèse figée de l'organisation courante. Jamais la clé d'idempotence, l'empreinte de la demande ni l'identifiant de la pièce émise.
 *
 * @property TaxSummary $resource
 */
final class SummaryResource extends JsonResource
{
    public static $wrap = 'data';

    public function __construct(TaxSummary $resource, private readonly bool $detail = false)
    {
        parent::__construct($resource);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $s = $this->resource;
        $donnees = [
            'id' => $s->id,
            'scope' => $s->scope->value,
            'mandant_party_id' => $s->mandant_party_id,
            'income_year' => $s->income_year,
            'form_version' => $s->form_version,
            'status' => $s->status->value,
            'currency' => $s->currency,
            'template_version' => $s->template_version,
            'supersedes_id' => $s->supersedes_id,
            'rectification_reason' => $s->rectification_reason,
            'has_pdf' => $s->stored_file_id !== null,
            'published_at' => $s->published_at?->toIso8601String(),
            'lock_version' => $s->lock_version,
            'created_at' => $s->created_at?->toIso8601String(),
        ];

        if ($this->detail) {
            $donnees['income'] = IncomeView::render($s->snapshot, false);
        } else {
            $donnees['totals'] = self::totals($s);
        }

        return $donnees;
    }

    /**
     * @return list<array{code: string, amount: array{amount: int, currency: string}}>
     */
    public static function totals(TaxSummary $s): array
    {
        $totaux = [];

        foreach ($s->snapshot['totals'] as $l) {
            if (in_array($l['code'], ['215', '240', '250', '261', '263'], true)) {
                $totaux[] = ['code' => $l['code'], 'amount' => ['amount' => (int) $l['rounded'], 'currency' => $s->currency]];
            }
        }

        return $totaux;
    }
}
