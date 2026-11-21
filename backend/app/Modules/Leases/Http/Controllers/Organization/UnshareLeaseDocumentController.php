<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Actions\UnshareLeaseDocument;
use App\Modules\Leases\Http\Resources\LeaseDocumentResource;
use App\Modules\Leases\Queries\LeaseDocuments;
use App\Modules\Leases\Queries\Leases;

final class UnshareLeaseDocumentController
{
    public function __invoke(string $lease, string $document, Leases $baux, LeaseDocuments $documents, UnshareLeaseDocument $action): LeaseDocumentResource
    {
        return new LeaseDocumentResource($action->handle($documents->get($baux->get($lease)->id, $document)));
    }
}
