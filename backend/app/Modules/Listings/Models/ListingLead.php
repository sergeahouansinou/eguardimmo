<?php

declare(strict_types=1);

namespace App\Modules\Listings\Models;

use App\Modules\Listings\Enums\LeadStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $listing_id
 * @property string $user_id
 * @property string $requested_slot
 * @property string|null $message
 * @property LeadStatus $status
 * @property Carbon|null $created_at
 */
final class ListingLead extends Model
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
        return ['message', 'requested_slot'];
    }

    protected function casts(): array
    {
        return ['status' => LeadStatus::class];
    }
}
