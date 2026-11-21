<?php

declare(strict_types=1);

namespace App\Modules\Leases\Models;

use App\Modules\Leases\Database\Factories\LeaseInsuranceSubmissionFactory;
use App\Modules\Leases\Enums\InsuranceRejectionReason;
use App\Modules\Leases\Enums\InsuranceSubmissionStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Dépôt d'une attestation d'assurance par un locataire : une demande, jamais une pièce tant que l'agence ne l'a pas acceptée (ADR 0036).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property string $party_id
 * @property string $stored_file_id
 * @property string $insurer
 * @property string $policy_number
 * @property Carbon $starts_on
 * @property Carbon $ends_on
 * @property string $client_id
 * @property InsuranceSubmissionStatus $status
 * @property InsuranceRejectionReason|null $rejection_reason
 * @property string|null $note
 * @property string|null $decided_by_user_id
 * @property Carbon|null $decided_at
 * @property string|null $certificate_id
 * @property Carbon $created_at
 */
#[UseFactory(LeaseInsuranceSubmissionFactory::class)]
final class LeaseInsuranceSubmission extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<LeaseInsuranceSubmissionFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['lease_id', 'party_id', 'stored_file_id', 'insurer', 'policy_number', 'starts_on', 'ends_on', 'client_id', 'status', 'rejection_reason', 'note', 'decided_by_user_id', 'decided_at', 'certificate_id'];

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['insurer', 'policy_number', 'note'];
    }

    protected function casts(): array
    {
        return [
            'insurer' => 'encrypted',
            'policy_number' => 'encrypted',
            'note' => 'encrypted',
            'starts_on' => 'date:Y-m-d',
            'ends_on' => 'date:Y-m-d',
            'status' => InsuranceSubmissionStatus::class,
            'rejection_reason' => InsuranceRejectionReason::class,
            'decided_at' => 'datetime',
        ];
    }
}
