<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $conversation_message_id
 * @property string $original_name
 * @property string $mime_type
 * @property int $size_bytes
 * @property string $path
 * @property-read ConversationMessage $message
 */
final class ConversationAttachment extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected $hidden = ['path'];

    /**
     * @return BelongsTo<ConversationMessage, $this>
     */
    public function message(): BelongsTo
    {
        return $this->belongsTo(ConversationMessage::class, 'conversation_message_id');
    }

    protected function casts(): array
    {
        return ['size_bytes' => 'integer'];
    }
}
