<?php

declare(strict_types=1);

namespace App\Modules\Identity\Models;

use App\Modules\Identity\Enums\TenantInvitationStatus;
use App\Modules\Identity\Enums\TenantRevoker;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * `live_party_id` est une colonne générée : une partie n'a jamais qu'une invitation en attente ou acceptée.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $party_id
 * @property string $organization_name
 * @property string $email
 * @property string|null $token_hash
 * @property TenantInvitationStatus $status
 * @property Carbon $expires_at
 * @property string $invited_by_user_id
 * @property string|null $accepted_by_user_id
 * @property Carbon|null $accepted_at
 * @property string|null $consent_version
 * @property Carbon|null $revoked_at
 * @property TenantRevoker|null $revoked_by
 * @property string|null $revoked_by_user_id
 * @property Carbon $created_at
 */
final class TenantInvitation extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    public const string CONSENT_VERSION = '2026-11';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['token_hash', 'live_party_id'];
    }

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['email'];
    }

    protected function casts(): array
    {
        return [
            'status' => TenantInvitationStatus::class,
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
            'revoked_at' => 'datetime',
            'revoked_by' => TenantRevoker::class,
        ];
    }
}
