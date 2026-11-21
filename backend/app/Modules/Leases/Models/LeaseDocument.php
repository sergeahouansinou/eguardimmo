<?php

declare(strict_types=1);

namespace App\Modules\Leases\Models;

use App\Modules\Leases\Database\Factories\LeaseDocumentFactory;
use App\Modules\Leases\Enums\LeaseDocumentKind;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Pièce du bail que l'agence partage avec les locataires (`party_id` nul) ou avec un seul colocataire ;
 * le retrait du partage (`revoked_at`) ne supprime pas le fichier (ADR 0036).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property string|null $party_id
 * @property string $stored_file_id
 * @property LeaseDocumentKind $kind
 * @property string $shared_by_user_id
 * @property Carbon $shared_at
 * @property Carbon|null $revoked_at
 */
#[UseFactory(LeaseDocumentFactory::class)]
final class LeaseDocument extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<LeaseDocumentFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['lease_id', 'party_id', 'stored_file_id', 'kind', 'shared_by_user_id', 'shared_at', 'revoked_at'];

    protected function casts(): array
    {
        return [
            'kind' => LeaseDocumentKind::class,
            'shared_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }
}
