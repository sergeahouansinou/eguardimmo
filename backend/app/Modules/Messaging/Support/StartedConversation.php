<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Messaging\Models\Conversation;

final readonly class StartedConversation
{
    public function __construct(public Conversation $conversation, public bool $replayed) {}
}
