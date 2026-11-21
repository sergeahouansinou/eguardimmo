<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Téléchargement par jeton : adresse IP et horodatage, écrit une fois (verrou en base).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $transmission_id
 * @property string $ip
 * @property Carbon $downloaded_at
 */
final class RecoveryTransmissionDownload extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    public $timestamps = false;

    protected $table = 'recovery_transmission_downloads';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['transmission_id', 'ip', 'downloaded_at'];

    protected function casts(): array
    {
        return ['downloaded_at' => 'datetime'];
    }
}
