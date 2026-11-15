<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Models;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\ScopeType;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string|null $user_id
 * @property string $email
 * @property string $first_name
 * @property string $last_name
 * @property MemberRole $role
 * @property MemberStatus $status
 * @property ScopeType $scope_type
 * @property list<string>|null $scope_property_ids
 * @property string|null $message
 * @property string|null $invitation_token_hash
 * @property Carbon|null $invitation_expires_at
 * @property Carbon|null $invited_at
 * @property string|null $invited_by_user_id
 * @property Carbon|null $joined_at
 * @property Carbon|null $disabled_at
 * @property-read User|null $user
 */
final class OrganizationMember extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;
    use SoftDeletes;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected $hidden = ['invitation_token_hash'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActiveTeamManager(): bool
    {
        return $this->status === MemberStatus::Active && $this->role->managesTeam();
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['invitation_token_hash'];
    }

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['email', 'message'];
    }

    protected function casts(): array
    {
        return [
            'role' => MemberRole::class,
            'status' => MemberStatus::class,
            'scope_type' => ScopeType::class,
            'scope_property_ids' => 'array',
            'invitation_expires_at' => 'datetime',
            'invited_at' => 'datetime',
            'joined_at' => 'datetime',
            'disabled_at' => 'datetime',
        ];
    }
}
