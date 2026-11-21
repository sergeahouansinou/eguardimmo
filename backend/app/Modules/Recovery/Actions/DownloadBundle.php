<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Actions;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Recovery\Models\RecoveryBundle;
use App\Shared\Audit\RecordAudit;
use Symfony\Component\HttpFoundation\StreamedResponse;

final readonly class DownloadBundle
{
    public function __construct(
        private DocumentStore $documents,
        private RecordAudit $audit,
    ) {}

    public function handle(RecoveryBundle $bundle): StreamedResponse
    {
        $this->audit->handle('recovery.bundle.downloaded', subject: $bundle, metadata: ['number' => $bundle->number, 'sha256' => $bundle->sha256]);

        return $this->documents->stream($bundle->stored_file_id);
    }
}
