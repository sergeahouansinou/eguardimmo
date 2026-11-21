<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\SupplierInvoice;
use Illuminate\Support\Str;

/**
 * Ordre fixe des verrous (ADR 0026) : intervention d'abord, puis facture, puis bail (dépôt de garantie), puis imputations ; une lecture non verrouillante
 * qui précède figerait, sous REPEATABLE READ, un instantané périmé.
 */
final class Locks
{
    public function intervention(string $id): Intervention
    {
        return (Str::isUuid($id) ? Intervention::query()->whereKey($id)->lockForUpdate()->first() : null)
            ?? throw ErrorCode::InterventionNotFound->problem();
    }

    public function invoice(string $id, string $interventionId): SupplierInvoice
    {
        return (Str::isUuid($id) ? SupplierInvoice::query()->whereKey($id)->where('intervention_id', $interventionId)->lockForUpdate()->first() : null)
            ?? throw ErrorCode::InvoiceNotFound->problem();
    }

    public function expectVersion(Intervention $intervention, ?int $version): void
    {
        if ($version !== null && $intervention->lock_version !== $version) {
            throw ErrorCode::StaleVersion->problem();
        }
    }
}
