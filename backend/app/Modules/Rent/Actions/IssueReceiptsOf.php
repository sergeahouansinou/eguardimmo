<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Rent\Models\Installment;
use Carbon\CarbonImmutable;

final readonly class IssueReceiptsOf
{
    public function __construct(private IssueSettledReceipts $quittances) {}

    /**
     * @param  list<string>  $installmentIds
     */
    public function handle(array $installmentIds, CarbonImmutable $today): void
    {
        $this->quittances->handle(array_values(Installment::query()->whereIn('id', $installmentIds)->get()->all()), $today);
    }
}
