<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Models;

use App\Modules\Documents\Enums\ScanStatus;
use App\Shared\Tenancy\BelongsToOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $conversation_message_id
 * @property string $original_name
 * @property string $mime_type
 * @property int $size_bytes
 * @property string|null $path
 * @property string|null $stored_file_id
 * @property ScanStatus $scan_status
 * @property CarbonImmutable|null $scanned_at
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
        return ['size_bytes' => 'integer', 'scan_status' => ScanStatus::class, 'scanned_at' => 'immutable_datetime'];
    }
}
