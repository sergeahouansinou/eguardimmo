<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $campaign_id
 * @property string $path
 * @property string $name
 * @property string $mime
 * @property int $size_bytes
 */
final class PlatformCampaignImage extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['size_bytes' => 'integer'];
    }
}
