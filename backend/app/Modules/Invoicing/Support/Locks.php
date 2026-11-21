<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Models\Invoice;
use Illuminate\Support\Str;

/**
 * Premier ordre de chaque transaction qui décide d'un statut ou d'un montant : sous REPEATABLE READ, une lecture non
 * verrouillante qui le précède figerait un instantané périmé (ADR 0028).
 */
final class Locks
{
    public function invoice(string $id): Invoice
    {
        return (Str::isUuid($id) ? Invoice::query()->whereKey($id)->lockForUpdate()->first() : null)
            ?? throw ErrorCode::InvoiceNotFound->problem();
    }
}
