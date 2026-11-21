<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Resources;

use App\Modules\Tax\Data\RentalIncomeData;
use App\Modules\Tax\Http\Support\IncomeView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Calcul à la volée : rien n'est figé, la réponse porte `provisional` tant que l'année n'est pas terminée.
 *
 * @property RentalIncomeData $resource
 */
final class RentalIncomeResource extends JsonResource
{
    public static $wrap = 'data';

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...IncomeView::render($this->resource->toSnapshot(), $this->resource->provisional),
            'blockers' => $this->resource->blockers,
        ];
    }
}
