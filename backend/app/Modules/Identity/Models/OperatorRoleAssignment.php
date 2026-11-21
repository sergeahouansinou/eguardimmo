<?php

declare(strict_types=1);

namespace App\Modules\Identity\Models;

use App\Modules\Identity\Enums\OperatorRole;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $operator_id
 * @property OperatorRole $role
 * @property Carbon $granted_at
 * @property string|null $granted_by_user_id
 */
final class OperatorRoleAssignment extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'operator_roles';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'role' => OperatorRole::class,
            'granted_at' => 'datetime',
        ];
    }
}
