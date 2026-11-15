<?php

declare(strict_types=1);

namespace App\Modules\Identity\Models;

use App\Modules\Identity\Enums\SocialProvider;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $user_id
 * @property SocialProvider $provider
 * @property string $subject
 * @property string|null $email
 * @property bool $email_verified
 * @property string|null $apple_refresh_token
 * @property string|null $apple_client_id
 * @property Carbon|null $last_used_at
 * @property-read User $user
 */
#[Hidden(['apple_refresh_token', 'subject'])]
final class SocialIdentity extends Model
{
    use HasUuids;

    protected $guarded = ['id'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function releaseForDeletedAccount(): void
    {
        $this->forceFill(['subject' => User::withDeletedMarker($this->subject, $this->id)])->save();
    }

    protected function casts(): array
    {
        return [
            'provider' => SocialProvider::class,
            'email_verified' => 'boolean',
            'apple_refresh_token' => 'encrypted',
            'last_used_at' => 'datetime',
        ];
    }
}
