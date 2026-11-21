<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Resources;

use App\Modules\Banking\Data\ParsedLine;
use App\Modules\Banking\Data\ParsedStatement;
use App\Modules\Banking\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Aperçu avant import : les premières lignes lues, les lignes refusées par leur numéro et leur code, jamais leur contenu.
 *
 * @property array{statement: ParsedStatement, preview: list<ParsedLine>, would_import: int, would_duplicate: int, already_imported: bool} $resource
 */
final class StatementPreviewResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $r = $this->resource;
        $releve = $r['statement'];

        return [
            'source' => $releve->source->value,
            'format_version' => $releve->formatVersion,
            'statement_ref' => $releve->reference,
            'period_from' => $releve->periodFrom->toDateString(),
            'period_to' => $releve->periodTo->toDateString(),
            'is_copy' => $releve->isCopy,
            'currency' => $releve->currency,
            'lines_total' => count($releve->lines),
            'would_import' => $r['would_import'],
            'would_duplicate' => $r['would_duplicate'],
            'already_imported' => $r['already_imported'],
            'rejected' => $releve->rejected,
            'lines' => array_map(static fn (ParsedLine $l): array => [
                'number' => $l->number,
                'booking_date' => $l->bookingDate->toDateString(),
                'value_date' => $l->valueDate?->toDateString(),
                'direction' => $l->direction->value,
                'amount' => MoneyShape::minor($l->amount, $l->currency),
                'label' => $l->label,
                'bank_reference' => $l->bankReference,
            ], $r['preview']),
        ];
    }
}
