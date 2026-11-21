<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Models;

use App\Modules\Maintenance\Enums\ApprovalDecision;
use App\Modules\Maintenance\Enums\ProofMethod;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Preuve d'une décision du mandant dans son espace, en ajout seul (déclencheurs) : empreinte d'un JSON canonique qui reprend
 * ce que le mandant a vu et décidé.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $intervention_id
 * @property string $approval_id
 * @property string|null $quote_id
 * @property string $mandant_party_id
 * @property string $access_id
 * @property string $user_id
 * @property ApprovalDecision $decision
 * @property int $amount
 * @property string $currency
 * @property string $fingerprint
 * @property string $quote_fingerprint
 * @property string $statement_version
 * @property string $payload
 * @property ProofMethod $proof_method
 * @property Carbon $proof_at
 * @property string|null $ip
 * @property string|null $user_agent
 * @property string $idempotency_key
 * @property Carbon $decided_at
 */
final class ApprovalEvidence extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    public const UPDATED_AT = null;

    protected $table = 'approval_evidences';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'decision' => ApprovalDecision::class,
            'proof_method' => ProofMethod::class,
            'proof_at' => PreciseTimestamp::class,
            'decided_at' => PreciseTimestamp::class,
            'amount' => 'integer',
        ];
    }
}
