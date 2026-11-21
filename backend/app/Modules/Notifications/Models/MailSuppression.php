<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Notifications\Enums\SuppressionReason;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Liste d'opposition par empreinte d'adresse : `scope_key` vaut l'organisation (désinscription) ou `platform` (rebond, plainte).
 *
 * @property string $id
 * @property string|null $organization_id
 * @property string $scope_key
 * @property string $email_hash
 * @property SuppressionReason $reason
 */
final class MailSuppression extends Model
{
    use HasUuids;

    public const string PLATEFORME = 'platform';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['reason' => SuppressionReason::class];
    }
}
