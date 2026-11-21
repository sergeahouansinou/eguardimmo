<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Models;

use App\Modules\Mandates\Enums\EndRequestStatus;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Demande du mandant de mettre fin à son mandat : l'agence seule résilie (ADR 0025). Une demande vivante par mandat.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $mandate_id
 * @property string $mandant_party_id
 * @property string $access_id
 * @property string $requested_by_user_id
 * @property EndRequestStatus $status
 * @property string|null $reason
 * @property Carbon|null $cancelled_at
 * @property Carbon|null $decided_at
 * @property string|null $decided_by_user_id
 * @property string|null $decision_note
 * @property Carbon $created_at
 */
final class MandateEndRequest extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['mandate_id', 'mandant_party_id', 'access_id', 'requested_by_user_id', 'status', 'reason', 'cancelled_at', 'decided_at', 'decided_by_user_id', 'decision_note'];

    protected $hidden = ['live_key'];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['status' => EndRequestStatus::class, 'cancelled_at' => 'datetime', 'decided_at' => 'datetime'];
    }
}
