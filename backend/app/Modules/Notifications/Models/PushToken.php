<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Notifications\Database\Factories\PushTokenFactory;
use App\Modules\Notifications\Enums\PushPlatform;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Le jeton d'appareil est chiffré et ne quitte jamais l'API : ni ressource, ni journal.
 *
 * @property string $id
 * @property string $user_id
 * @property string|null $access_token_id
 * @property PushPlatform $platform
 * @property string|null $token
 * @property string $token_hash
 * @property string|null $device_name
 * @property CarbonImmutable|null $revoked_at
 * @property CarbonImmutable $created_at
 * @property CarbonImmutable $updated_at
 */
#[UseFactory(PushTokenFactory::class)]
final class PushToken extends Model
{
    /** @use HasFactory<PushTokenFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    protected $hidden = ['token', 'token_hash'];

    public static function hash(#[\SensitiveParameter] string $token): string
    {
        return hash('sha256', $token);
    }

    protected function casts(): array
    {
        return [
            'platform' => PushPlatform::class,
            'token' => 'encrypted',
            'revoked_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
