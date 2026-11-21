<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Resources;

use App\Modules\Investments\Data\ScheduleRowData;
use App\Modules\Investments\Http\Support\Shapes;
use App\Modules\Investments\Models\Loan;
use App\Modules\Investments\Support\Currencies;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property Loan $resource
 */
final class ScheduleResource extends JsonResource
{
    public static $wrap = 'data';

    /**
     * @param  list<ScheduleRowData>  $rows
     */
    public function __construct(Loan $pret, private readonly array $rows)
    {
        parent::__construct($pret);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $devise = $this->resource->currency;
        $m = fn (int $v): array => Shapes::money(Currencies::money($v, $devise));

        return [
            'loan_id' => $this->resource->id,
            'source' => $this->resource->schedule_source->value,
            'currency' => $devise,
            'lines' => array_map(fn (ScheduleRowData $r, int $i): array => [
                'position' => $i + 1,
                'due_on' => $r->dueOn,
                'payment' => $m($r->payment),
                'interest' => $m($r->interest),
                'principal' => $m($r->principal),
                'insurance' => $m($r->insurance),
                'total' => $m($r->payment + $r->insurance),
                'outstanding_after' => $m($r->outstandingAfter),
            ], $this->rows, array_keys($this->rows)),
            'totals' => [
                'interest' => $m(array_sum(array_map(fn (ScheduleRowData $r): int => $r->interest, $this->rows))),
                'insurance' => $m(array_sum(array_map(fn (ScheduleRowData $r): int => $r->insurance, $this->rows))),
                'principal' => $m(array_sum(array_map(fn (ScheduleRowData $r): int => $r->principal, $this->rows))),
            ],
        ];
    }
}
