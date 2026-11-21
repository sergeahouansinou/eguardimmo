<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Actions\UnshareMandateDocument;
use App\Modules\Mandates\Http\Resources\MandateDocumentResource;
use App\Modules\Mandates\Queries\MandateDocuments;
use App\Modules\Mandates\Queries\Mandates;

final class UnshareMandateDocumentController
{
    public function __invoke(string $mandate, string $document, Mandates $mandats, MandateDocuments $documents, UnshareMandateDocument $action): MandateDocumentResource
    {
        return new MandateDocumentResource($action->handle($documents->get($mandats->get($mandate)->id, $document)));
    }
}
