<?php

declare(strict_types=1);

namespace App\Modules\Planning\Models;

use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Exactement un des deux : un membre (`user_id`) ou une fiche de contact (`party_id`). Aucune invitation n'est envoyée à un tiers.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $event_id
 * @property string|null $user_id
 * @property string|null $party_id
 */
final class PlanningEventAttendee extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];
}
