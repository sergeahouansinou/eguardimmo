<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Controllers\Organization;

use App\Modules\Invoicing\Actions\DiscardDraft;
use App\Modules\Invoicing\Http\Resources\InvoiceResource;

final class DiscardInvoiceController
{
    public function __invoke(string $invoice, DiscardDraft $abandonner): InvoiceResource
    {
        return new InvoiceResource($abandonner->handle($invoice));
    }
}
