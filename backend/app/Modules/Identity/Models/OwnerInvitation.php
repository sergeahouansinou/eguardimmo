<?php

declare(strict_types=1);

namespace App\Modules\Identity\Models;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Enums\OwnerInvitationStatus;
use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Identity\Support\TenantInvitationToken;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * `live_mandant_id` et `live_email` sont des colonnes générées : un mandant n'a jamais qu'une invitation en attente par adresse.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $mandant_party_id
 * @property string|null $person_party_id
 * @property OwnerAccessRole $role
 * @property string $organization_name
 * @property string $email
 * @property string|null $token_hash
 * @property string|null $code_hash
 * @property int $code_attempts
 * @property OwnerInvitationStatus $status
 * @property Carbon $expires_at
 * @property string $invited_by_user_id
 * @property Carbon $identity_attested_at
 * @property bool $powers_attested
 * @property string|null $accepted_by_user_id
 * @property Carbon|null $accepted_at
 * @property string|null $consent_version
 * @property Carbon|null $revoked_at
 * @property OwnerRevoker|null $revoked_by
 * @property string|null $revoked_by_user_id
 * @property Carbon $created_at
 */
final class OwnerInvitation extends Model
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
        return ['token_hash', 'code_hash', 'code_attempts', 'live_mandant_id', 'live_email'];
    }

    /**
     * Fin de vie de l'invitation : jeton et code effacés, adresse réduite à son indice. L'adresse en clair ne sert qu'en attente.
     *
     * @return array<string, mixed>
     */
    public function endedAttributes(OwnerInvitationStatus $statut): array
    {
        return [
            'status' => $statut,
            'token_hash' => null,
            'code_hash' => null,
            'email' => TenantInvitationToken::hint($this->email),
        ];
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
            'role' => OwnerAccessRole::class,
            'status' => OwnerInvitationStatus::class,
            'code_attempts' => 'integer',
            'expires_at' => 'datetime',
            'identity_attested_at' => 'datetime',
            'powers_attested' => 'boolean',
            'accepted_at' => 'datetime',
            'revoked_at' => 'datetime',
            'revoked_by' => OwnerRevoker::class,
        ];
    }
}
