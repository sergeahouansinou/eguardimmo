<?php

declare(strict_types=1);

namespace App\Modules\Payments\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Événement reçu d'un fournisseur, avant de connaître l'organisation : unique sur (fournisseur, identifiant), ce qui rend le rejeu inoffensif.
 *
 * @property string $id
 * @property string $provider
 * @property string $event_id
 * @property string $type
 * @property Carbon $received_at
 * @property Carbon|null $processed_at
 */
final class PaymentProviderEvent extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['provider', 'event_id', 'type', 'received_at', 'processed_at'];

    protected function casts(): array
    {
        return ['received_at' => 'datetime', 'processed_at' => 'datetime'];
    }
}
