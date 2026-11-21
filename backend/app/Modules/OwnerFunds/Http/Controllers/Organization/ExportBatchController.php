<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Enums\PayoutBatchStatus;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use App\Modules\OwnerFunds\Support\PayoutCsv;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

final class ExportBatchController
{
    public function __invoke(string $batch, PayoutCsv $csv, RecordAudit $audit): Response
    {
        $lot = (Str::isUuid($batch) ? PayoutBatch::query()->whereKey($batch)->first() : null) ?? throw ErrorCode::BatchNotFound->problem();

        if (! in_array($lot->status, [PayoutBatchStatus::Validated, PayoutBatchStatus::Executed], true)) {
            throw ErrorCode::NotValidatable->problem('Seul un lot validé peut être exporté.');
        }

        $audit->handle('ownerfunds.batch.exported', subject: $lot, metadata: ['number' => $lot->number]);

        return response($csv->render($lot->load('items')), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$lot->number.'.csv"',
            'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
