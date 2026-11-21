<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Controllers\Organization;

use App\Modules\Invoicing\Actions\IssueInvoice;
use App\Modules\Invoicing\Http\Resources\InvoiceResource;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class IssueInvoiceController
{
    public function __invoke(string $invoice, IssueInvoice $emettre): JsonResponse
    {
        $resultat = $emettre->handle($invoice, CarbonImmutable::today());

        return (new InvoiceResource($resultat['invoice']->load(['lines', 'taxes', 'payments']), null, $resultat['replayed']))
            ->response()
            ->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
