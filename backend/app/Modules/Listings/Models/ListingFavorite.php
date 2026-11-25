<?php

declare(strict_types=1);

namespace App\Modules\Listings\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Donnée du voyageur, sans organisation : la clé est le couple (compte, annonce).
 *
 * @property string $id
 * @property string $user_id
 * @property string $listing_id
 */
final class ListingFavorite extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];
}
