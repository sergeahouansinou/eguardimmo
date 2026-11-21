<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Rent\Queries\Receipts;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadReceiptController
{
    public function __invoke(string $receipt, Receipts $quittances, DocumentStore $documents): StreamedResponse
    {
        return $documents->stream($quittances->get($receipt)->stored_file_id);
    }
}
