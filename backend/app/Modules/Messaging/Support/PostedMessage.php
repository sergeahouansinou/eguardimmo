<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Messaging\Models\ConversationMessage;

final readonly class PostedMessage
{
    public function __construct(public ConversationMessage $message, public bool $replayed) {}
}
