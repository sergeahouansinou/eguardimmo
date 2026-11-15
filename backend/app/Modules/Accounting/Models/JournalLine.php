<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Models;

use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Support\ImmutableRecord;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Money\Money;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $journal_entry_id
 * @property int $position
 * @property string $account_id
 * @property Money $debit
 * @property Money $credit
 * @property string $currency
 * @property string|null $lease_id
 * @property string|null $party_id
 * @property string|null $unit_id
 * @property ItemType|null $item_type
 * @property string|null $item_id
 * @property-read Account $account
 */
final class JournalLine extends Model
{
    use BelongsToOrganization;
    use HasUuids;
    use ImmutableRecord;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return BelongsTo<Account, $this>
     */
    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    protected function casts(): array
    {
        return [
            'debit' => MoneyCast::class.':currency',
            'credit' => MoneyCast::class.':currency',
            'item_type' => ItemType::class,
            'position' => 'integer',
        ];
    }
}
