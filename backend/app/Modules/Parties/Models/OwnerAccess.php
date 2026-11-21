<?php

declare(strict_types=1);

namespace App\Modules\Parties\Models;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Parties\Database\Factories\OwnerAccessFactory;
use App\Modules\Parties\Enums\OwnerAccessStatus;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Lien d'un compte à un mandant (ADR 0032). Les colonnes `active_*` sont générées : un compte n'a qu'un accès actif par mandant.
 * Le journal passe par RecordAudit (`parties.owner_access.linked|unlinked`), sans modèle auditable : aucune donnée personnelle.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $mandant_party_id
 * @property string $user_id
 * @property OwnerAccessRole $role
 * @property string|null $person_party_id
 * @property OwnerAccessStatus $status
 * @property string $invitation_id
 * @property string $consent_version
 * @property Carbon $consented_at
 * @property string $identity_attested_by_user_id
 * @property Carbon $identity_attested_at
 * @property Carbon|null $revoked_at
 * @property OwnerRevoker|null $revoked_by
 */
#[UseFactory(OwnerAccessFactory::class)]
final class OwnerAccess extends Model
{
    use BelongsToOrganization;

    /** @use HasFactory<OwnerAccessFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'role' => OwnerAccessRole::class,
            'status' => OwnerAccessStatus::class,
            'consented_at' => 'datetime',
            'identity_attested_at' => 'datetime',
            'revoked_at' => 'datetime',
            'revoked_by' => OwnerRevoker::class,
        ];
    }
}
