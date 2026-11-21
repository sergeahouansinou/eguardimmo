<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Controllers\Organization;

use App\Modules\Invoicing\Actions\UpdateDraft;
use App\Modules\Invoicing\Http\Requests\DraftRequest;
use App\Modules\Invoicing\Http\Resources\InvoiceResource;
use Carbon\CarbonImmutable;

final class UpdateInvoiceController
{
    public function __invoke(string $invoice, DraftRequest $request, UpdateDraft $modifier): InvoiceResource
    {
        return new InvoiceResource($modifier->handle($invoice, $request->toData(), CarbonImmutable::today())->load(['lines', 'taxes']));
    }
}
