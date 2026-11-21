<?php

declare(strict_types=1);

namespace App\Modules\Investments\Models;

use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $property_id
 * @property string|null $unit_id
 * @property string $scope_key
 * @property Carbon $acquired_on
 * @property string $currency
 * @property Money $price
 * @property Money $acquisition_costs
 * @property Money $agency_fees
 * @property Money $initial_works
 * @property string|null $stored_file_id
 * @property string $idempotency_key
 * @property string $fingerprint
 * @property int $lock_version
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class PropertyAcquisition extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'acquired_on' => 'date:Y-m-d',
            'price' => MoneyCast::class.':currency',
            'acquisition_costs' => MoneyCast::class.':currency',
            'agency_fees' => MoneyCast::class.':currency',
            'initial_works' => MoneyCast::class.':currency',
            'lock_version' => 'integer',
        ];
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['price', 'acquisition_costs', 'agency_fees', 'initial_works', 'idempotency_key', 'fingerprint'];
    }

    public function total(): Money
    {
        return $this->price->add($this->acquisition_costs, $this->agency_fees, $this->initial_works);
    }
}
