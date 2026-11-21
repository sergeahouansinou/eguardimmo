<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Models;

use App\Modules\Maintenance\Enums\VisitSlot;
use App\Modules\Maintenance\Enums\VisitStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $intervention_id
 * @property string|null $supplier_party_id
 * @property Carbon $scheduled_on
 * @property VisitSlot $slot
 * @property bool $presence_required
 * @property VisitStatus $status
 * @property Carbon|null $requested_on
 * @property VisitSlot|null $requested_slot
 * @property string|null $contact_name
 * @property string|null $contact_phone
 * @property int $lock_version
 */
final class InterventionVisit extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['contact_name', 'contact_phone'];
    }

    protected function casts(): array
    {
        return [
            'scheduled_on' => 'date:Y-m-d',
            'requested_on' => 'date:Y-m-d',
            'slot' => VisitSlot::class,
            'requested_slot' => VisitSlot::class,
            'status' => VisitStatus::class,
            'presence_required' => 'boolean',
            'lock_version' => 'integer',
        ];
    }
}
