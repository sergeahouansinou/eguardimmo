<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Controllers\Organization;

use App\Modules\Invoicing\Actions\DownloadInvoice;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadInvoiceController
{
    public function __invoke(string $invoice, DownloadInvoice $telecharger): StreamedResponse
    {
        return $telecharger->handle($invoice);
    }
}
