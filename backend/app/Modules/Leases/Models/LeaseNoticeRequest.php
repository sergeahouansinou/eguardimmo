<?php

declare(strict_types=1);

namespace App\Modules\Leases\Models;

use App\Modules\Leases\Enums\NoticeRequestOutcome;
use App\Modules\Leases\Enums\NoticeRequestStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Demande de congé d'une fiche locataire : l'agence l'acte par `notice` ou `parties/{leaseParty}/end`, jamais le locataire (ADR 0036).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property string $party_id
 * @property string $reason_key
 * @property Carbon $requested_departure_on
 * @property Carbon $earliest_departure_on
 * @property string|null $proof_file_id
 * @property string|null $forwarding_address
 * @property string|null $letter_document_id
 * @property string|null $letter_file_id
 * @property string|null $letter_fingerprint
 * @property string $consent_version
 * @property string $client_id
 * @property NoticeRequestStatus $status
 * @property Carbon|null $received_on
 * @property string|null $acknowledged_by_user_id
 * @property Carbon|null $acknowledged_at
 * @property Carbon|null $withdrawn_at
 * @property NoticeRequestOutcome|null $closed_outcome
 * @property Carbon|null $closed_at
 * @property Carbon|null $late_flagged_at
 * @property Carbon $created_at
 */
final class LeaseNoticeRequest extends Model
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
        return ['reason_key', 'forwarding_address'];
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['reason_key', 'forwarding_address', 'proof_file_id'];
    }

    protected function casts(): array
    {
        return [
            'requested_departure_on' => 'date:Y-m-d',
            'earliest_departure_on' => 'date:Y-m-d',
            'received_on' => 'date:Y-m-d',
            'forwarding_address' => 'encrypted',
            'status' => NoticeRequestStatus::class,
            'closed_outcome' => NoticeRequestOutcome::class,
            'acknowledged_at' => 'datetime',
            'withdrawn_at' => 'datetime',
            'closed_at' => 'datetime',
            'late_flagged_at' => 'datetime',
        ];
    }
}
