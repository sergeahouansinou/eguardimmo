<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Enums;

enum ConversationKind: string
{
    case Internal = 'internal';
    case Tenant = 'tenant';
    case Owner = 'owner';

    public function isExternal(): bool
    {
        return $this !== self::Internal;
    }

    public function counterpartSide(): MessageSide
    {
        return match ($this) {
            self::Tenant => MessageSide::Tenant,
            self::Owner => MessageSide::Owner,
            self::Internal => MessageSide::Staff,
        };
    }
}
