<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Resources;

use App\Modules\Tax\Http\Support\IncomeView;
use App\Modules\Tax\Models\TaxSummary;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Relevé publié tel que l'agence l'a émis. Jamais l'identifiant d'une pièce de dépense, d'une facture ou d'un prêt, la clé d'idempotence,
 * l'empreinte, l'auteur de la publication ni l'identifiant du mandant.
 *
 * @property array{summary: TaxSummary, agency_name: string|null, detail: bool} $resource
 */
final class OwnerTaxStatementResource extends JsonResource
{
    public static $wrap = 'data';

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $s = $this->resource['summary'];
        $donnees = [
            'id' => $s->id,
            'agency' => ['id' => $s->organization_id, 'name' => $this->resource['agency_name']],
            'income_year' => $s->income_year,
            'form_version' => $s->form_version,
            'status' => $s->status->value,
            'currency' => $s->currency,
            'supersedes_id' => $s->supersedes_id,
            'has_pdf' => $s->stored_file_id !== null,
            'published_at' => $s->published_at?->toIso8601String(),
        ];

        if ($this->resource['detail']) {
            $donnees['income'] = IncomeView::render($s->snapshot, false, false);
        } else {
            $donnees['totals'] = SummaryResource::totals($s);
        }

        return $donnees;
    }
}
