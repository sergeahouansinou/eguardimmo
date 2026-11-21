<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum InterventionStatus: string
{
    case Reported = 'reported';
    case Qualified = 'qualified';
    case Declined = 'declined';
    case Cancelled = 'cancelled';
    case Quoting = 'quoting';
    case AwaitingApproval = 'awaiting_approval';
    case Approved = 'approved';
    case Scheduled = 'scheduled';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Invoiced = 'invoiced';
    case Closed = 'closed';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Declined, self::Cancelled, self::Closed], true);
    }

    /**
     * @return list<self>
     */
    public function next(): array
    {
        return match ($this) {
            self::Reported => [self::Qualified, self::Declined, self::Cancelled],
            self::Qualified => [self::Declined, self::Quoting, self::Approved, self::Cancelled],
            self::Quoting => [self::AwaitingApproval, self::Approved, self::Cancelled],
            self::AwaitingApproval => [self::Approved, self::Quoting, self::Cancelled],
            self::Approved => [self::Scheduled, self::Cancelled],
            self::Scheduled => [self::InProgress, self::Approved, self::Scheduled, self::Cancelled],
            self::InProgress => [self::Completed, self::Approved, self::Scheduled, self::Cancelled],
            self::Completed => [self::InProgress, self::Invoiced, self::Closed],
            self::Invoiced => [self::Closed],
            self::Declined, self::Cancelled, self::Closed => [],
        };
    }

    public function canGoTo(self $cible): bool
    {
        return in_array($cible, $this->next(), true);
    }

    /**
     * Seuls états montrés au locataire : aucun détail financier ni de planification interne.
     */
    public function tenantState(): string
    {
        return match ($this) {
            self::Reported, self::Qualified, self::Quoting, self::AwaitingApproval, self::Approved => 'reported',
            self::Scheduled, self::InProgress => 'in_progress',
            self::Completed, self::Invoiced, self::Closed => 'done',
            self::Declined => 'declined',
            self::Cancelled => 'cancelled',
        };
    }

    /**
     * États portés par une intervention encore ouverte pour le plafond par bail.
     *
     * @return list<self>
     */
    public static function open(): array
    {
        return [self::Reported, self::Qualified, self::Quoting, self::AwaitingApproval, self::Approved, self::Scheduled, self::InProgress];
    }
}
