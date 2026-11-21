<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Queries\Installments;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadNoticeController
{
    public function __invoke(string $installment, Installments $echeances, DocumentStore $documents): StreamedResponse
    {
        $avis = $echeances->get($installment)->notice ?? throw ErrorCode::NoticeNotFound->problem();

        return $documents->stream($avis->stored_file_id);
    }
}
