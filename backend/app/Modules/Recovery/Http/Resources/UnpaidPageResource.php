<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Resources;

use App\Modules\Recovery\Data\Receivable;
use App\Modules\Recovery\Enums\ItemType;
use App\Modules\Recovery\Support\ApiShapes;
use App\Modules\Recovery\Support\UnpaidPage;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property UnpaidPage $resource
 */
final class UnpaidPageResource extends JsonResource
{
    public function __construct(UnpaidPage $page, private readonly CarbonImmutable $today)
    {
        parent::__construct($page);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        $p = $this->resource;

        return array_map(function (Receivable $i) use ($p): array {
            $partie = $i->partyId === null ? null : ($p->parties[$i->partyId] ?? null);

            return [
                'type' => $i->type->value,
                'item_id' => $i->id,
                'installment_id' => $i->type === ItemType::Installment ? $i->id : null,
                'invoice_id' => $i->type === ItemType::Invoice ? $i->id : null,
                'reference' => $i->reference,
                'lease' => ['id' => $i->leaseId, 'reference' => ($p->leases[$i->leaseId] ?? null)?->reference],
                'party' => $i->partyId === null ? null : ['id' => $i->partyId, 'name' => $partie?->displayName],
                'period' => $i->periodStart === null ? null : ['start' => $i->periodStart, 'end' => $i->periodEnd],
                'issued_on' => $i->issuedOn,
                'due_date' => $i->dueDate,
                'days_overdue' => (int) CarbonImmutable::parse($i->dueDate)->diffInDays($this->today),
                'status' => $i->status,
                'total' => ApiShapes::money($i->total),
                'outstanding' => ApiShapes::money($i->outstanding),
                'case' => $p->cases[$i->id] ?? null,
            ];
        }, $p->items);
    }

    /**
     * @return array<string, mixed>
     */
    public function with(Request $request): array
    {
        return ['meta' => ['next_after' => $this->resource->nextAfter]];
    }
}
