<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum ApprovalStatus: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Refused = 'refused';
    case Question = 'question';
    case Expired = 'expired';
    case Withdrawn = 'withdrawn';

    public function isOpen(): bool
    {
        return $this === self::Pending || $this === self::Question;
    }
}
