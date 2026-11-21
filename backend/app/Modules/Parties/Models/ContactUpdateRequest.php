<?php

declare(strict_types=1);

namespace App\Modules\Parties\Models;

use App\Modules\Parties\Enums\ContactUpdateStatus;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Coordonnées que le locataire propose à une agence (ADR 0036) : valeurs lues sur son compte, chiffrées, effacées dès la décision.
 * Le modèle n'est pas audité (les valeurs ne vont jamais au journal) ; les actions le sont par `RecordAudit`.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $party_id
 * @property string $requested_by_user_id
 * @property string $client_id
 * @property string|null $email
 * @property string|null $phone
 * @property ContactUpdateStatus $status
 * @property string|null $decided_by_user_id
 * @property Carbon|null $decided_at
 * @property Carbon $created_at
 */
final class ContactUpdateRequest extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    public const int RETENTION_DAYS = 90;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected $hidden = ['email', 'phone'];

    protected function casts(): array
    {
        return [
            'email' => 'encrypted',
            'phone' => 'encrypted',
            'status' => ContactUpdateStatus::class,
            'decided_at' => 'datetime',
        ];
    }
}
