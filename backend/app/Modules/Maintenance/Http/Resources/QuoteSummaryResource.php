<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources;

use App\Modules\Maintenance\Http\Support\Shapes;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionQuote;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Arr;

/**
 * @property InterventionQuote $resource
 */
final class QuoteSummaryResource extends JsonResource
{
    public function __construct(InterventionQuote $devis, private readonly ?Intervention $intervention, private readonly ?InterventionApproval $accord)
    {
        parent::__construct($devis);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...Arr::except((new QuoteResource($this->resource))->toArray($request), 'lines'),
            'intervention' => $this->intervention === null ? null : [
                'id' => $this->intervention->id,
                'reference' => $this->intervention->reference,
                'status' => $this->intervention->status->value,
                'unit_id' => $this->intervention->unit_id,
            ],
            'approval' => $this->accord === null ? null : [
                'status' => $this->accord->status->value,
                'ceiling_amount' => Shapes::money($this->accord->ceiling_amount),
                'decide_before' => $this->accord->decide_before->toIso8601String(),
            ],
        ];
    }
}
