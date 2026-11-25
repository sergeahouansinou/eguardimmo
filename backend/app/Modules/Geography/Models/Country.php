<?php

declare(strict_types=1);

namespace App\Modules\Geography\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Référentiel en lecture seule : aucun cloisonnement par organisation.
 *
 * @property string $id
 * @property string $code
 * @property string $name
 */
final class Country extends Model
{
    use HasUuids;

    protected $table = 'geo_countries';

    protected $guarded = ['id'];
}
