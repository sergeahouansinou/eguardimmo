<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\PublicApi\OperatorDirectory;
use App\Modules\Messaging\Data\TicketPatchData;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Models\SupportTicket;
use Illuminate\Support\Facades\DB;

final readonly class UpdateSupportTicket
{
    public function __construct(private OperatorDirectory $operateurs) {}

    public function handle(SupportTicket $ticket, TicketPatchData $modifications): SupportTicket
    {
        if ($modifications->assigneeUserId !== null && ! $this->operateurs->isActive($modifications->assigneeUserId)) {
            throw ErrorCode::NotAnOperator->problem();
        }

        return DB::transaction(function () use ($ticket, $modifications): SupportTicket {
            if ($modifications->status !== null) {
                $ticket->status = $modifications->status;
                $ticket->resolved_at = $modifications->status === TicketStatus::Resolved ? now() : null;
            }

            if ($modifications->priority !== null) {
                $ticket->priority = $modifications->priority;
            }

            if ($modifications->assigneeProvided) {
                $ticket->assignee_user_id = $modifications->assigneeUserId;
            }

            $ticket->last_activity_at = now();
            $ticket->save();

            return $ticket;
        });
    }
}
