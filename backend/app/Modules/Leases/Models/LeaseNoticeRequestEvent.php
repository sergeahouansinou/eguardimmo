<?php

declare(strict_types=1);

namespace App\Modules\Leases\Models;

use App\Modules\Leases\Enums\NoticeRequestEventKind;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Journal de preuve en ajout seul (déclencheur de base, ADR 0017) : jamais modifié, jamais supprimé.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $notice_request_id
 * @property NoticeRequestEventKind $kind
 * @property string|null $actor_user_id
 * @property string|null $ip
 * @property string|null $user_agent
 * @property string|null $reauth_method
 * @property string|null $consent_version
 * @property array<string, mixed>|null $data
 * @property Carbon $occurred_at
 */
final class LeaseNoticeRequestEvent extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    public $timestamps = false;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'kind' => NoticeRequestEventKind::class,
            'data' => 'array',
            'occurred_at' => 'datetime',
        ];
    }
}
