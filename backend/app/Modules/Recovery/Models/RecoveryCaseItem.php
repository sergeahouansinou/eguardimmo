<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Models;

use App\Modules\Recovery\Enums\ItemType;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Créance d'un dossier. Période, échéance, montant appelé et `amount_due` (reste dû) sont l'instantané de l'inclusion,
 * pour l'historique seulement : le reste dû courant se lit au grand livre. Le retrait ferme la ligne (`removed_at`), rien n'est effacé.
 * Une facture n'a pas de période : `period_start` et `period_end` y portent sa date d'émission, `reference` son numéro.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $case_id
 * @property ItemType $item_type
 * @property string $item_id
 * @property string|null $reference
 * @property string $currency
 * @property Carbon $period_start
 * @property Carbon $period_end
 * @property Carbon $due_date
 * @property Money $total_amount
 * @property Money $amount_due
 * @property Carbon $included_at
 * @property string|null $included_by_user_id
 * @property Carbon|null $removed_at
 * @property string|null $removed_by_user_id
 */
final class RecoveryCaseItem extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $table = 'recovery_case_items';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['case_id', 'item_type', 'item_id', 'reference', 'currency', 'period_start', 'period_end', 'due_date', 'total_amount', 'amount_due', 'included_at', 'included_by_user_id', 'removed_at', 'removed_by_user_id'];

    protected function casts(): array
    {
        return [
            'item_type' => ItemType::class,
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'due_date' => 'date:Y-m-d',
            'total_amount' => MoneyCast::class.':currency',
            'amount_due' => MoneyCast::class.':currency',
            'included_at' => 'datetime',
            'removed_at' => 'datetime',
        ];
    }
}
