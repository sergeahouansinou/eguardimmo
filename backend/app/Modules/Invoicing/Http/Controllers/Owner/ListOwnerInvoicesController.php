<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Invoicing\Http\Requests\ListOwnerInvoicesRequest;
use App\Modules\Invoicing\Http\Resources\Owner\OwnerInvoicePageResource;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Queries\OwnerInvoices;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;

final class ListOwnerInvoicesController
{
    public function __invoke(ListOwnerInvoicesRequest $request, MandateDirectory $mandats, OwnerInvoices $factures, OrganizationDirectory $organisations): OwnerInvoicePageResource
    {
        /** @var User $user */
        $user = $request->user();
        $page = $factures->page($mandats->ownerScope($user->id, $request->agency()), $request->perPage(), $request->cursor());
        $noms = $organisations->names(array_values(array_unique(array_map(fn (Invoice $f): string => $f->organization_id, $page->items()))));

        return new OwnerInvoicePageResource($page, $noms);
    }
}
