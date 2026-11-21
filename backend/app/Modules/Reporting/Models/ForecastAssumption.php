<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Models;

use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $indexation_rate pourcentage, trois décimales
 * @property string $expense_growth_rate pourcentage, trois décimales
 * @property list<array{unit_id: string, from: string, to: string}> $vacancies
 * @property list<array{month: string, label: string, amount: int}> $one_off_expenses
 * @property int $lock_version
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class ForecastAssumption extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['vacancies', 'one_off_expenses', 'lock_version'];
    }

    protected function casts(): array
    {
        return [
            'indexation_rate' => 'decimal:3',
            'expense_growth_rate' => 'decimal:3',
            'vacancies' => 'array',
            'one_off_expenses' => 'array',
            'lock_version' => 'integer',
        ];
    }
}
