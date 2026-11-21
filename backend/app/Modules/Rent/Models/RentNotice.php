<?php

declare(strict_types=1);

namespace App\Modules\Rent\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Avis d'échéance émis : pièce figée (ADR 0022), jamais modifiée après sa création.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $installment_id
 * @property string $number
 * @property string $issued_document_id
 * @property string $stored_file_id
 * @property string $fingerprint
 * @property string $template_version
 * @property array<string, mixed> $snapshot
 * @property Carbon $issued_on
 * @property string|null $issued_by_user_id
 */
final class RentNotice extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $table = 'rent_notices';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'installment_id', 'number', 'issued_document_id', 'stored_file_id', 'fingerprint', 'template_version', 'snapshot',
        'issued_on', 'issued_by_user_id',
    ];

    protected function casts(): array
    {
        return ['snapshot' => 'array', 'issued_on' => 'date:Y-m-d'];
    }
}
