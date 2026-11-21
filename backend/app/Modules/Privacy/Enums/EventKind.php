<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Enums;

enum EventKind: string
{
    case Received = 'received';
    case Verified = 'verified';
    case Extended = 'extended';
    case Forwarded = 'forwarded';
    case ForwardHandled = 'forward_handled';
    case Exported = 'exported';
    case Downloaded = 'downloaded';
    case ExportPurged = 'export_purged';
    case DueFlagged = 'due_flagged';
    case ErasureExecuted = 'erasure_executed';
    case Completed = 'completed';
    case Refused = 'refused';
}
