<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Models;

use App\Modules\Organizations\Database\Factories\OrganizationFactory;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Enums\SuspensionReason;
use App\Shared\Audit\Auditable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property OrganizationKind $kind
 * @property string $name
 * @property string $country
 * @property string $timezone
 * @property bool $two_factor_required
 * @property string $created_by_user_id
 * @property Carbon $created_at
 * @property Carbon|null $suspended_at
 * @property SuspensionReason|null $suspension_reason
 */
#[UseFactory(OrganizationFactory::class)]
final class Organization extends Model
{
    use Auditable;

    /** @use HasFactory<OrganizationFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    /** @var array<string, mixed> */
    protected $attributes = [
        'suspended_at' => null,
        'suspension_reason' => null,
    ];

    public function isSuspended(): bool
    {
        return $this->suspended_at !== null;
    }

    public function auditOrganizationId(): string
    {
        return (string) $this->getKey();
    }

    /**
     * La suspension a ses propres événements d'audit (organizations.organization.suspended|reactivated).
     *
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['suspended_at', 'suspension_reason'];
    }

    protected function casts(): array
    {
        return [
            'kind' => OrganizationKind::class,
            'two_factor_required' => 'boolean',
            'suspended_at' => 'datetime',
            'suspension_reason' => SuspensionReason::class,
        ];
    }
}
