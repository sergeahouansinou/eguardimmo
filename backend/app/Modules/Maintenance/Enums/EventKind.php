<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum EventKind: string
{
    case Reported = 'reported';
    case Updated = 'updated';
    case Qualified = 'qualified';
    case Declined = 'declined';
    case Cancelled = 'cancelled';
    case Comment = 'comment';
    case SupplierAssigned = 'supplier_assigned';
    case VisitProposed = 'visit_proposed';
    case VisitConfirmed = 'visit_confirmed';
    case VisitRescheduleRequested = 'visit_reschedule_requested';
    case VisitDone = 'visit_done';
    case VisitCancelled = 'visit_cancelled';
    case VisitNoShow = 'visit_no_show';
    case QuoteRecorded = 'quote_recorded';
    case QuoteSubmitted = 'quote_submitted';
    case QuoteAccepted = 'quote_accepted';
    case QuoteRefused = 'quote_refused';
    case ApprovalRequested = 'approval_requested';
    case ApprovalDecided = 'approval_decided';
    case ApprovalExpired = 'approval_expired';
    case ApprovalWithdrawn = 'approval_withdrawn';
    case Approved = 'approved';
    case EmergencyEngaged = 'emergency_engaged';
    case Started = 'started';
    case Completed = 'completed';
    case Reopened = 'reopened';
    case Invoiced = 'invoiced';
    case Closed = 'closed';
    case FileAdded = 'file_added';
    case FileShared = 'file_shared';
}
