<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Photo jointe à une remarque ; Documents en retire les métadonnées (EXIF, position) au dépôt.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $remark_id
 * @property string $stored_file_id
 * @property int $position
 * @property Carbon $created_at
 */
final class InspectionRemarkFile extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    public const UPDATED_AT = null;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['remark_id', 'stored_file_id', 'position'];
}
