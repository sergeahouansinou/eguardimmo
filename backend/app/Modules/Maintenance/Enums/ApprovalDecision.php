<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum ApprovalDecision: string
{
    case Accept = 'accept';
    case Refuse = 'refuse';
    case Question = 'question';
}
