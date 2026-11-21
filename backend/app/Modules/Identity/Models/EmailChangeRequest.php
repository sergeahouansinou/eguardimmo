<?php

declare(strict_types=1);

namespace App\Modules\Identity\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Demande de changement d'adresse (ADR 0036) : la nouvelle adresse est chiffrée, le code n'existe qu'en empreinte.
 * Une seule demande vivante par compte ; elle n'est pas auditée par le modèle (le journal n'a ni adresse ni code).
 *
 * @property string $id
 * @property string $user_id
 * @property string $email
 * @property string $email_hash
 * @property string $code_hash
 * @property int $attempts
 * @property Carbon $expires_at
 * @property Carbon|null $consumed_at
 */
final class EmailChangeRequest extends Model
{
    use HasUuids;

    public const int MAX_ATTEMPTS = 5;

    public const int VALIDITY_MINUTES = 15;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    protected $hidden = ['email', 'code_hash'];

    protected function casts(): array
    {
        return [
            'email' => 'encrypted',
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }
}
