<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Http\Resources\Owner\OwnerInvoiceResource;
use App\Modules\Invoicing\Queries\OwnerInvoices;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use Illuminate\Http\Request;

final class ShowOwnerInvoiceController
{
    public function __invoke(string $invoice, Request $request, MandateDirectory $mandats, OwnerInvoices $factures, OrganizationDirectory $organisations): OwnerInvoiceResource
    {
        /** @var User $user */
        $user = $request->user();
        $facture = $factures->find($mandats->ownerScope($user->id), $invoice, true) ?? throw ErrorCode::OwnerInvoiceNotFound->problem();

        return new OwnerInvoiceResource(['invoice' => $facture, 'agency_name' => $organisations->names([$facture->organization_id])[$facture->organization_id] ?? null, 'detail' => true]);
    }
}
