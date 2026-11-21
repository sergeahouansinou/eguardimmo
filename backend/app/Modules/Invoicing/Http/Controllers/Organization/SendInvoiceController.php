<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Controllers\Organization;

use App\Modules\Invoicing\Actions\SendInvoice;
use App\Modules\Invoicing\Http\Resources\InvoiceResource;

final class SendInvoiceController
{
    public function __invoke(string $invoice, SendInvoice $envoyer): InvoiceResource
    {
        return new InvoiceResource($envoyer->handle($invoice));
    }
}
