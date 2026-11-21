<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Models;

use App\Modules\Maintenance\Enums\ApprovalBasis;
use App\Modules\Maintenance\Enums\InterventionOrigin;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\Priority;
use App\Modules\Maintenance\Enums\ReportedUrgency;
use App\Modules\Maintenance\Enums\Responsibility;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $reference
 * @property InterventionOrigin $origin
 * @property InterventionStatus $status
 * @property Priority $priority
 * @property ReportedUrgency|null $reported_urgency
 * @property string $nature_term_id
 * @property string $title
 * @property string $description
 * @property string|null $room
 * @property string|null $availability
 * @property string|null $property_id
 * @property string|null $unit_id
 * @property string|null $lease_id
 * @property string|null $mandate_id
 * @property string|null $mandant_party_id
 * @property string|null $reporter_party_id
 * @property string|null $supplier_party_id
 * @property Responsibility $responsibility
 * @property Carbon $reported_on
 * @property Carbon|null $due_on
 * @property Money|null $estimated_amount
 * @property Money|null $ceiling_amount
 * @property string $currency
 * @property ApprovalBasis|null $approval_basis
 * @property string|null $emergency_reason
 * @property string|null $decline_reason
 * @property string|null $decline_note
 * @property Carbon|null $completed_on
 * @property string|null $completion_note
 * @property Carbon|null $closed_at
 * @property string|null $follows_intervention_id
 * @property array<string, mixed>|null $custom_fields
 * @property string|null $idempotency_key
 * @property string|null $request_hash
 * @property string|null $created_by_user_id
 * @property int $lock_version
 * @property Carbon|null $created_at
 */
final class Intervention extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return HasMany<InterventionEvent, $this>
     */
    public function events(): HasMany
    {
        return $this->hasMany(InterventionEvent::class, 'intervention_id')->orderBy('created_at')->orderBy('id');
    }

    /**
     * @return HasMany<InterventionFile, $this>
     */
    public function files(): HasMany
    {
        return $this->hasMany(InterventionFile::class, 'intervention_id')->orderBy('created_at')->orderBy('id');
    }

    /**
     * @return HasMany<InterventionVisit, $this>
     */
    public function visits(): HasMany
    {
        return $this->hasMany(InterventionVisit::class, 'intervention_id')->orderBy('scheduled_on')->orderBy('id');
    }

    /**
     * @return HasMany<InterventionQuote, $this>
     */
    public function quotes(): HasMany
    {
        return $this->hasMany(InterventionQuote::class, 'intervention_id')->orderBy('created_at')->orderBy('id');
    }

    /**
     * @return HasMany<InterventionApproval, $this>
     */
    public function approvals(): HasMany
    {
        return $this->hasMany(InterventionApproval::class, 'intervention_id')->orderBy('requested_at')->orderBy('id');
    }

    /**
     * @return HasMany<SupplierInvoice, $this>
     */
    public function invoices(): HasMany
    {
        return $this->hasMany(SupplierInvoice::class, 'intervention_id')->orderBy('created_at')->orderBy('id');
    }

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['title', 'description', 'room', 'availability', 'decline_note', 'completion_note', 'emergency_reason', 'custom_fields'];
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['request_hash'];
    }

    protected function casts(): array
    {
        return [
            'origin' => InterventionOrigin::class,
            'status' => InterventionStatus::class,
            'priority' => Priority::class,
            'reported_urgency' => ReportedUrgency::class,
            'responsibility' => Responsibility::class,
            'approval_basis' => ApprovalBasis::class,
            'reported_on' => 'date:Y-m-d',
            'due_on' => 'date:Y-m-d',
            'completed_on' => 'date:Y-m-d',
            'estimated_amount' => MoneyCast::class.':currency',
            'ceiling_amount' => MoneyCast::class.':currency',
            'closed_at' => 'datetime',
            'custom_fields' => 'array',
            'lock_version' => 'integer',
        ];
    }
}
