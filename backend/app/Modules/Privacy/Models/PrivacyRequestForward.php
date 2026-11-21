<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Transmission d'une demande à une organisation liée au compte : le nom et l'adresse sont une copie chiffrée du jour de la transmission.
 *
 * @property string $id
 * @property string $privacy_request_id
 * @property string $organization_id
 * @property string $requester_name
 * @property string $requester_email
 * @property Carbon $forwarded_at
 * @property Carbon|null $handled_at
 * @property string|null $handled_by_user_id
 * @property-read PrivacyRequest $privacyRequest
 */
final class PrivacyRequestForward extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /** @var array<string, mixed> */
    protected $attributes = ['handled_at' => null, 'handled_by_user_id' => null];

    /**
     * @return BelongsTo<PrivacyRequest, $this>
     */
    public function privacyRequest(): BelongsTo
    {
        return $this->belongsTo(PrivacyRequest::class, 'privacy_request_id');
    }

    protected function casts(): array
    {
        return [
            'requester_name' => 'encrypted',
            'requester_email' => 'encrypted',
            'forwarded_at' => 'datetime',
            'handled_at' => 'datetime',
        ];
    }
}
