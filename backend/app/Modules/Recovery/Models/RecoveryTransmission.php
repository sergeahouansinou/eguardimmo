<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Lien de téléchargement d'un envoi. Seule l'empreinte du jeton est stockée ; le jeton n'existe qu'à la création.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $bundle_id
 * @property string $recipient_party_id
 * @property string $recipient_email
 * @property string $token_hash
 * @property Carbon $expires_at
 * @property Carbon|null $revoked_at
 * @property string|null $revoked_by_user_id
 * @property Carbon|null $sent_at
 * @property Carbon|null $first_downloaded_at
 * @property int $download_count
 * @property string|null $replaces_id
 * @property string|null $created_by_user_id
 * @property Carbon $created_at
 */
final class RecoveryTransmission extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $table = 'recovery_transmissions';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'bundle_id', 'recipient_party_id', 'recipient_email', 'token_hash', 'expires_at', 'revoked_at', 'revoked_by_user_id', 'sent_at',
        'first_downloaded_at', 'download_count', 'replaces_id', 'created_by_user_id',
    ];

    protected $hidden = ['token_hash'];

    /**
     * @return HasMany<RecoveryTransmissionDownload, $this>
     */
    public function downloads(): HasMany
    {
        return $this->hasMany(RecoveryTransmissionDownload::class, 'transmission_id')->orderByDesc('downloaded_at')->orderByDesc('id');
    }

    public function isUsable(Carbon $now): bool
    {
        return $this->revoked_at === null && $this->expires_at->greaterThan($now);
    }

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'sent_at' => 'datetime',
            'first_downloaded_at' => 'datetime',
            'download_count' => 'integer',
        ];
    }
}
